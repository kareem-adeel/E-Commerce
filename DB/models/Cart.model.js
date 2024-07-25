import mongoose,{model,Schema, Types} from "mongoose";

export const cartSchema=new Schema({

        userId:{
            type:Types.ObjectId,
            required:true,
            ref:'User',
            unique:true
        },

        products:[
            {
                productId:{
                    type:Types.ObjectId,
                    required:true,
                    ref:'Product',
                    unique:true
                    
                },
                quantity:{
                    type:Number,
                  required:true
                }
            }
        ]
},{
    timestamps:true
})

const cartModel=mongoose.model.cartSchema||model('Cart',cartSchema)

export default cartModel


// import mongoose from "mongoose";
// const { Schema, Types, model } = mongoose;

// const cartSchema = new Schema(
//   {
//     userId: {
//       type: Types.ObjectId,
//       required: true,
//       ref: "User",
//     },
//     products: [
//       {
//         productId: {
//           type: Types.ObjectId,
//           required: true,
//           ref: "Product",
//         },
//         quantity: {
//           type: Number,
//           required: true,
//           min: 1,
//         },
//       },
//     ],
//   },
//   { timestamps: true }
// );

// // Drop the existing index
// cartSchema.index({ "products.productId": 1 }, { unique: true, sparse: true });

// const cartModel = mongoose.model("Cart", cartSchema);

// export default cartModel;