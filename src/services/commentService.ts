import { commentBaseResponseDto } from "../interfaces/common/commentBaseResponseDto";
import { commentCreateDto } from "../interfaces/comment/commentCreateDto";
import { commentResponseDto } from "../interfaces/comment/commentResponseDto";
import { commentUpdateDto } from "../interfaces/comment/commentUpdateDto";
import { AnyBulkWriteOperation } from "mongodb";
import mongoose from "mongoose";
import logger from "../log/logger";
import Comment from "../models/Comment";
import moment from "moment";

const createComment = async (commentCreateDto: commentCreateDto): Promise<commentBaseResponseDto> => {
  try {
    // create를 위해 각 filed명에 값들을 할당시켜준다.
      const comment = new Comment({
          post_id: commentCreateDto.post_id,
          userName: commentCreateDto.userName,
          content: commentCreateDto.content,
          comment_level: commentCreateDto.comment_level,
          comment_id: commentCreateDto?.comment_id,
          parents_comment_id: commentCreateDto?.parents_comment_id,
          dateTimeOfPosting: moment().format("YYYY-MM-DD hh:mm:ss"),
          parent: commentCreateDto?.parent,
          children: commentCreateDto?.children,  
      });
      await comment.save();

      const data = {
          _id: comment.id
      };

      return data;
  } catch (error) {
      console.log(error);
      throw error;
  }
}

const updateComment = async (commentId: string, commentUpdateDto: commentUpdateDto): Promise<commentUpdateDto | null> => {
  try {
      await Comment.findByIdAndUpdate(commentId, commentUpdateDto); // update 로직
      const comment = await findPostById(commentId); // update 된 정보를 불러오는 로직
      // null이 될 경우를 처리해줘야 한다.
      if (!comment) {
      return null;
      }
      return comment;
  } catch (error) {
      logger.error(error);
      throw error;
  }
};

const findPostById = async (postId: string): Promise<commentResponseDto | any> => {
try {
  const comment = await Comment.find({ post_id: postId });

  if (!comment) {
    return null;
  }
  return comment;
} catch (error) {
  logger.error(error);
  throw error;
}
};

let bulkArr: AnyBulkWriteOperation<any>[] = [];

const getChildId = (list: any[], useYN: string) => {
  list.map((v: { [key: string]: any }, i: number) => {
    bulkArr.push({
      updateOne: {
        filter: { _id: v._id },
        update: { $set: { useYN: useYN } },
      },
    });
    if (v.childComment.length > 0) {
      getChildId(v.childComment, useYN);
    }
  });
};

const updateCommentTree = async (commentId: string, commentUpdateDto: commentUpdateDto): Promise<commentUpdateDto | null> => {
    try {
        getChildId([commentUpdateDto.selectedComment], commentUpdateDto.content as string);
        await Comment.bulkWrite(bulkArr);
        const comment = await findPostById(commentId); // update 된 정보를 불러오는 로직

        // null이 될 경우를 처리해줘야 한다.
        if (!comment) {
         return null;
        }
        return comment;
    } catch (error) {
        logger.error(error);
        throw error;
    }
};

const findCommentTree = async (commentId: string): Promise<commentResponseDto | null | any[]> => {
  try {
    const ObjectId = mongoose.Types.ObjectId;

    const comment = await Comment.aggregate([
      { $match: { _id: new ObjectId(commentId) } },
      {
        $graphLookup: {
          from: "comments",
          startWith: "$parents_comment_id",
          connectFromField: "parents_comment_id",
          connectToField: "comment_id",
          depthField: "level",
          as: "childComment",
        },
      },
      {
        $unwind: {
          path: "$childComment",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          "childComment.level": -1,
        },
      },
      {
        $group: {
          _id: "$_id",
          post_id: { $first: "$post_id" },
          userName: { $first: "$userName" },
          content: { $first: "$content" },
          comment_id: { $first: "$comment_id" },
          dateTimeOfPosting: { $first: "$dateTimeOfPosting" },
          parents_comment_id: { $first: "$parents_comment_id" },
          childComment: {
            $push: {
              _id: "$childComment._id",
              post_id: "$childComment.post_id",
              userName: "$childComment.userName",
              content: "$childComment.content",
              comment_id: "$childComment.comment_id",
              dateTimeOfPosting: "$childComment.dateTimeOfPosting",
              parents_comment_id: "$childComment.parents_comment_id",
              level: "$childComment.level",
            },
          },
        },
      },
      {
        $addFields: {
          childComment: {
            $reduce: {
              input: "$childComment",
              initialValue: {
                level: -1,
                presentChild: [],
                prevChild: [],
              },
              in: {
                $let: {
                  vars: {
                    prev: {
                      $cond: [
                        { $eq: ["$$value.level", "$$this.level"] },
                        "$$value.prevChild",
                        "$$value.presentChild",
                      ],
                    },
                    current: {
                      $cond: [
                        { $eq: ["$$value.level", "$$this.level"] },
                        "$$value.presentChild",
                        [],
                      ],
                    },
                  },
                  in: {
                    level: "$$this.level",
                    prevChild: "$$prev",
                    presentChild: {
                      $concatArrays: [
                        "$$current",
                        [
                          {
                            _id: "$$this._id",
                            post_id: "$$this.post_id",
                            userName: "$$this.userName",
                            content: "$$this.content",
                            comment_id: "$$this.comment_id",
                            dateTimeOfPosting: "$$this.dateTimeOfPosting",
                            parents_comment_id: "$$this.parents_comment_id",
                            level: "$$this.level",
                            childComment: {
                              $filter: {
                                input: "$$prev",
                                as: "e",
                                cond: {
                                  $eq: [
                                    "$$e.comment_id",
                                    "$$this.parents_comment_id",
                                  ],
                                },
                              },
                            },
                          },
                        ],
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $addFields: { childComment: "$childComment.presentChild" } },
    ]);

    if (!comment) {
      return null;
    }
    return comment;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const findCommentAll = async () => {
  try {
    let comment = await Comment.find({ menu_level: 1 })
      .populate("children")
      .sort({ category_number: 1, dateTimeOfCommentCreating: -1 })
      .exec();

    //오브젝트용 가공 샘플
    // interface ObjType {
    //     [key: string]: any[]
    // }
    // let obj : ObjType = {};
    let list: any[] = [];

    if (!comment) {
      return null;
    } else {
      comment.map((e: any, i) => {
        if (list[e.post_id]) {
          list[e.post_id].push(e);
        } else {
          list[e.post_id] = [];
          list[e.post_id].push(e);
        }
        //오브젝트용 가공 샘플
        // if(obj[e.additional.category]) {
        //     obj[e.additional.category].push(e);
        // }else{
        //     obj[e.additional.category] = [];
        //     obj[e.additional.category].push(e);
        // }
      });
    }

    return list;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const deleteComment = async (
  commentId: string
): Promise<commentResponseDto | any> => {
  try {
    const comment = await Comment.findByIdAndDelete(commentId);
    if (!comment) {
      return null;
    }
    return comment;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

export default {
  createComment,    
  updateComment,
  findPostById,
  updateCommentTree,
  findCommentTree,   
  findCommentAll,
  deleteComment,
}