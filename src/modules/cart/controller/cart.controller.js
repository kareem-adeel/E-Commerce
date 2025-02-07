import cartModel from "../../../../DB/models/Cart.model.js";
import productModel from "../../../../DB/models/Product.model.js";
import { asyncHandler } from "../../../utils/errorHandling.js";

//1-userId has cart-->Update cart
//2-userId Donot have cart-->Create

export const addToCart = asyncHandler(async (req, res, next) => {
  const { _id } = req.user;
  const { productId, quantity } = req.body;
  const cart = await cartModel.findOne({ userId: _id });
  const product = await productModel.findOne({
    _id: productId,
    isDeleted: false,
    stock: { $gte: quantity },
  });

  if (!cart) {
    const data = {
      userId: _id,
      products: [
        {
          productId: product._id,
          quantity,
        },
      ],
    };
    const newCart = await cartModel.create(data);
    return res.status(201).json({ message: "Done", cart: newCart });
  }
  let exist = false;
  for (let product of cart.products) {
    if (product.productId.toString() == productId) {
      product.quantity = quantity;
      exist = true;
      break;
    }
  }
  if (!exist) {
    const add = await cartModel.findByIdAndUpdate(
      { _id: cart._id },
      {
        $push: {
          products: {
            productId: product._id,
            quantity,
          },
        },
      },
      { new: true }
    );
    return res.status(200).json({ message: "Done", cart: add });
  }

  const add = await cartModel.findByIdAndUpdate(
    { _id: cart._id },
    { products: cart.products },
    { new: true }
  );
  return res.status(200).json({ message: "Done", cart: add });
});

// export const addToCart = asyncHandler(async (req, res, next) => {
//   const { _id } = req.user;
//   const { productId, quantity } = req.body;

//   try {
//     // Find the cart associated with the user
//     let cart = await cartModel.findOne({ userId: _id });

//     // Find the product to be added to the cart
//     const product = await productModel.findOne({
//       _id: productId,
//       isDeleted: false,
//       stock: { $gte: quantity },
//     });

//     if (!product) {
//       return next(new Error("Invalid ProductId", { cause: 404 }));
//     }

//     if (!cart) {
//       // If cart doesn't exist, create a new cart
//       cart = new cartModel({
//         userId: _id,
//         products: [],
//       });
//     }

//     // Check if the product already exists in the cart
//     const existingProduct = cart.products.find(
//       (item) => item.productId.toString() === productId
//     );

//     if (existingProduct) {
//       // If product exists, update its quantity
//       existingProduct.quantity += quantity;
//     } else {
//       // If product doesn't exist, add it to the cart
//       cart.products.push({ productId, quantity });
//     }

//     // Save the updated cart
//     await cart.save();

//     return res.status(200).json({ message: "Product added to cart successfully" });
//   } catch (error) {
//     return next(error);
//   }
// });






export const deleteFromCart=asyncHandler(
  async (req,res,next)=>{
    const {_id}=req.user

    const cart=await cartModel.findOne({userId:_id})

    if(!cart){

      return next (new Error ("Cart Not Found",{cause:404}))
    }

    const newCart=await cartModel.findByIdAndUpdate({_id:cart._id},
      {
        $pull:{
            products:{
              productId: {$in :req.params.productId}
            }
        }
      },{new:true}
      )
      return res.status(200).json({ message: "Done", cart: newCart })

  }
)


export const clearCart=asyncHandler(
  async (req,res,next)=>{
    const {_id}=req.user

    const cart=await cartModel.findOne({userId:_id})

    if(!cart){

      return next (new Error ("Cart Not Found",{cause:404}))
    }

    const newCart=await cartModel.findByIdAndUpdate({_id:cart._id},
      {
        products:[]
      },{new:true}
      )
      return res.status(200).json({ message: "Done", cart: newCart })

  }
)