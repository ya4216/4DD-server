import mongoose from "mongoose";
import { commentInfoDto } from "../interfaces/comment/commentInfoDto";

const { Schema } = mongoose;

const CommentSchema = new Schema({
        // post: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'Post',
        //     require: true,
        // },
        post_id: {
            type: String,
            required: true
        },
        userName: {
            type: String,
            required: true,
        },
        content: {
            type: String
        },
        comment_level : {
            type: Number,
            required: true,
            default: 1
        },
        parentsComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
        },
        dateTimeOfComment: {
            type: Date,
            required: true,
            default: Date.now,
        },
        // parentComment: { // 1
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'Comment',
        // },
        // depth: {
        //     type: Number,
        //     default: 1,
        // },
        isDeleted: { // 2
            type: Boolean,
            default: false,
        }
    },
    { toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

CommentSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentsComment',
});

// CommentSchema
//   .virtual('childComments')
//   .get(function () {
//     return this._childComments;
//   })
//   .set(function (v) {
//     this._childComments = v;
// });
  
// CommentSchema.virtual('child').get(function () {
//     return this.child;
// }).set(function (v) {
//     this.child = v;
// });
  

export default mongoose.model<commentInfoDto & mongoose.Document>("Comment", CommentSchema);