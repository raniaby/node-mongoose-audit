import mongoose, { Schema, Document } from "mongoose";
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
    return JSON.stringify(obj)
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
  schema.pre("updateMany", async function (this: any, next) {
    try {
      const oldValues = await this.model.find(this._conditions);
      this.oldDocs = oldValues;
      next();
    } catch (error: any) {
      next(error);
    }
  });

  schema.post("updateMany", async function (this: any) {
    try {
      const { deleted, deletedAt, ...rest } = this._conditions;
      const updatedDocs = await this.model.findWithDeleted(rest);
      for (const updatedDoc of updatedDocs) {
        const oldCorrespondingDoc = this.oldDocs.find(
          (el: any) => el._id.toString() === updatedDoc._id.toString()
        );
        if (oldCorrespondingDoc) {
          await saveDiffObject(
            oldCorrespondingDoc.toObject({ depopulate: true }),
            updatedDoc.toObject({ depopulate: true })
          );
        }
      }
    } catch (error) {
      console.error(error);
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
      await saveDiffObject(this.old, updated.toObject({ depopulate: true }));
    } catch (error: any) {
      console.error(error);
    }
  });
}

export default lastModifiedPlugin;
