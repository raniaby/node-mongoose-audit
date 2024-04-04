import mongoose, { Schema, Document, Model } from "mongoose";
import History, {
  HistoryDocument,
  HistoryModel,
  historySchema,
} from "./model.js";
import * as jsondiffpatch from "jsondiffpatch";
const jsondiffpatchInstance = jsondiffpatch.create({
  // used to match objects when diffing arrays, by default only === operator is used
  objectHash: function (obj: any) {
    // this function is used only to when objects are not equal by ref
    return obj._id || obj.id;
  },
});

export async function saveDiffObject(currentObject: any, updated: any) {
  try {
    let diff = jsondiffpatchInstance.diff(
      JSON.parse(JSON.stringify(currentObject)),
      JSON.parse(JSON.stringify(updated))
    );
    if (!diff || Object.keys(diff).length == 0) {
      return;
    }

    const collectionId = currentObject._id;
    const collectionName = currentObject.constructor.modelName;
    const affectedColumns = Object.keys(diff);
    const lastHistory = await History.model
      .findOne({ collectionId, collectionName })
      .sort("-version");
    const history = new History.model({
      collectionId,
      collectionName,
      original: currentObject,
      updated,
      affectedColumns,
      version: lastHistory ? lastHistory.version + 1 : 0,
    });

    return history.save();
  } catch (error) {
    console.error(error);
  }
}

export async function initConnection(uri: string) {
  try {
    await mongoose.connect(uri);
    mongoose.model<HistoryDocument, HistoryModel>("History", historySchema);
  } catch (error) {
    console.error(error);
  }
}

function lastModifiedPlugin<T extends Document>(schema: Schema<T>): void {
  schema.pre("save", async function (this: T, next) {
    if (this.isNew) return next();
    try {
      const ModelClass = this.constructor as Model<T>;
      const original = await ModelClass.findOne({ _id: this._id });
      await saveDiffObject(original, this.toObject({ depopulate: true }));
      next();
    } catch (err: any) {
      next(err);
    }
  });

  schema.pre("findOneAndUpdate", async function (this: any, next) {
    try {
      const doc = await this.model.findOne(this._conditions);
      this.old = doc.toObject({ depopulate: true });
      next();
    } catch (error: any) {
      next(error);
    }
  });
  schema.post("findOneAndUpdate", async function (this: any) {
    try {
      const updated = await this.model.findOne(this._conditions);
      await saveDiffObject(this.old, updated.toObject({ depopulate: true }));
    } catch (error: any) {
      console.error(error);
    }
  });

  schema.pre("updateOne", async function (this: any, next) {
    try {
      const doc = await this.model.findOne(this._conditions);
      this.old = doc.toObject({ depopulate: true });
      next();
    } catch (error: any) {
      next(error);
    }
  });

  schema.post("updateOne", async function (this: any) {
    try {
      const updated = await this.model.findOne(this._conditions);
      await saveDiffObject(this.old, updated);
    } catch (error: any) {
      console.error(error);
    }
  });
}

export default lastModifiedPlugin;
