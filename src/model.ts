import mongoose, { Schema, Document, Model, Types, model } from 'mongoose';

export interface HistoryDocument extends Document {
    collectionName: string;
    collectionId: Types.ObjectId;
    original: object,
    updated: object,
    affectedColumns: string [],
    version: number;
}

export interface HistoryModel extends Model<HistoryDocument> {
    model: Model<HistoryDocument>;
}

export const historySchema = new Schema(
    {
        collectionName: String,
        collectionId: Schema.Types.ObjectId,
        original: {},
        updated: {},
        affectedColumns: [],
        version: { type: Number, min: 0 },
    },
    {
        timestamps: true,
    }
);

const historyModel= {
    model: mongoose.model<HistoryDocument, HistoryModel>('History', historySchema)
}


export default historyModel;
