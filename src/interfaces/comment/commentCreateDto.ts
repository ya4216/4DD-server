import mongoose from "mongoose";

export interface commentCreateDto {
    post_id: string;
    userName: string;
    content: string;
    comment_level : number;
    comment_id?: string;
    parentsComment?: string;
    dateTimeOfPosting?: Date;
    parent?: mongoose.Schema.Types.ObjectId;
    children?: [mongoose.Schema.Types.ObjectId];
}