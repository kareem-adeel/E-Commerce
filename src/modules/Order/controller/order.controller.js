import cartModel from "../../../../DB/models/Cart.model.js";
import couponModel from "../../../../DB/models/Coupon.model.js";
import orderModel from "../../../../DB/models/Order.model.js";
import productModel from "../../../../DB/models/Product.model.js";
import createInvoice from "../../../utils/createInvoice.js";
import sendEmail from "../../../utils/email.js";
import { asyncHandler } from "../../../utils/errorHandling.js";
import payment from "../../../utils/payment.js";
import Stripe from "stripe";


//1-cart-Select proucts from cart

export const createOrder = asyncHandler(
    async (req, res, next) => {
        const { _id } = req.user
        let { products, couponName } = req.body
        let amount = 0

        let coupon = { amount: 0 }
        if (couponName) {
            coupon = await couponModel.findOne({ name: couponName, usedBy: { $nin: _id } })
            if (!coupon) {
                return next(new Error("Invaild Coupon", { cause: 404 }));
            }

            if (coupon.expireIn && coupon.expireIn.getTime() < new Date().getTime()) {
                return next(new Error("Coupon Expired", { cause: 400 }));

            }
            amount = coupon.amount
            req.body.couponId = coupon._id
        }

        if (!products?.length) {

            const cart = await cartModel.findOne({ userId: _id })
            if (!cart?.products?.length) {
                return next(new Error("Cart not found", { cause: 404 }));
            }
            // need to modify

            products = cart.products.toObject()
        }
        const allProducts = []
        let subPrice = 0
        for (const product of products) {
            const productExist = await productModel.findOne({
                _id: product.productId,
                isDeleted: false,
                stock: { $gte: product.quantity }
            })

            if (!productExist) {
                return next(new Error("product not found", { cause: 400 }));
            }

            product.name = productExist.name,
                product.unitPrice = productExist.finalPrice,
                product.totalPrice = productExist.finalPrice * product.quantity
            allProducts.push(product)
            subPrice += product.totalPrice

        }

        for (const product of products) {
            await cartModel.updateOne({ userId: _id },
                {
                    $pull: {
                        products: {
                            productId: { $in: product.productId }
                        }
                    }
                }
            )

            await productModel.updateOne({ _id: product.productId }, { $inc: { stock: parseInt(-product.quantity) } })
        }


        req.body.products = allProducts
        req.body.subPrice = subPrice
        req.body.finalPrice = subPrice - (subPrice * coupon?.amount) / 100
        req.body.status = req.body.paymentTypes == "cash" ? "placed" : "waitForPayment"
        const order = await orderModel.create(
            req.body
        )
        if (couponName) {
            await couponModel.updateOne({ _id: coupon._id }, { $push: { usedBy: _id } })
        }

        //create invoice
        const invoice = {
            shipping: {
                name: req.user.userName,
                address: order.address,
                city: "San Francisco",
                state: "CA",
                country: "US",
                postal_code: 94111
            },
            items: order.products,
            subtotal: subPrice,
            paid: 0,
            invoice_nr: order._id.toString(),
            createdAt: order.createdAt
        };

        createInvoice(invoice, "invoice.pdf");

        await sendEmail({
            to: req.user.email, subject: "invoice", attachments: [
                {
                    path: "invoice.pdf",
                    application: "application/pdf"
                }
            ]
        })

        //  if payment card
        if (order.paymentTypes = "card") {
            const stripe = new Stripe(process.env.STRIPE_KEY);
            let couponStripe
            if (couponName) {
                couponStripe = await stripe.coupons.create({
                    percent_off: amount,
                    duration: "once"
                })
            }

            const session = await payment({
                metadata: {
                    orderid: order._id.toString(),
                },
                discounts: amount ? [{ coupon: couponStripe.id }] : [],
                success_url: `${process.env.SUCCUESS_URL}/${order._id}`,
                cancel_url: `${process.env.CANCEL_URL}/${order._id}`,
                customer_email: req.user.email,
                line_items: order.products.map((element) => {
                    return {

                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: element.name
                            },
                            unit_amount: element.unitPrice * 100
                        },
                        quantity: element.quantity

                    }
                })
            })
            return res.json({ message: "Done", order, session })
        }

        return res.json({ message: "Done", order })
    }
)

//1-check if order found -->
//2-order no valid for cancel if only 'placed' 'waitForPayment'
//3-change stock
//4-remove user from usedBy
//5-update order to cancel
export const cancelOrder = asyncHandler(
    async (req, res, next) => {
        const { orderId } = req.params

        const order = await orderModel.findById({ _id: orderId })

        if (!order) {
            return next(new Error("Order not found", { cause: 404 }));
        }


        if (order.status != 'placed' && order.status != 'waitForPayment') {
            return next(new Error("Not Valid Cancel", { cause: 400 }));
        }

        for (const product of order.products) {
            await productModel.updateOne({ _id: product.productId }, { $inc: { stock: parseInt(product.quantity) } })
        }

        if (order.couponId) {
            await couponModel.updateOne({ _id: order.couponId }, { $pull: { usedBy: req.user._id } })
        }



        const updateOrder = await orderModel.updateOne({ _id: orderId }, { status: 'cancel', updatedBy: req.user._id })

        return res.status(200).json({ message: "Done", updateOrder })
    }
)


//1-check if order found -->
//2-order no valid for cancel if only 'onWay'
//5-update order to deliverd
export const deliverOrder = asyncHandler(
    async (req, res, next) => {
        const { orderId } = req.params

        const order = await orderModel.findById({ _id: orderId })

        if (!order) {
            return next(new Error("Order not found", { cause: 404 }));
        }

        if (order.status != 'onWay') {
            return next(new Error("Invalid Deliverd Order", { cause: 400 }));
        }

        const updateOrder = await orderModel.updateOne({ _id: orderId }, { status: 'deliverd', updatedBy: req.user._id })

        return res.status(200).json({ message: "Done", updateOrder })
    }
)


export const webHook = asyncHandler(async (req, res, next) => {
    const stripe = new Stripe(process.env.STRIPE_KEY);
    const endpointSecret = process.env.ENDPOINT_SECERT;
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);

    }

    // Handle the event
    if (event.type == 'checkout.session.completed') {
        let orderId = event.data.object.metadata.orderId

        const updateOrder = await orderModel.updateOne({ _id: orderId }, { status: "placed" });
        return res.status(200).json({ message: "Done" })
    }
    return next(new Error("failed To payment", { cause: 500 }))
})