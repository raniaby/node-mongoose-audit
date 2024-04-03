import mongoose, { Schema, Document, Model, Query } from "mongoose";
import History, {
  HistoryDocument,
  HistoryModel,
  historySchema,
} from "./model.js";

import * as jsondiffpatch from "jsondiffpatch";
import { pick, assign } from "lodash"; // Assuming lodash library is used for pick and assign functions
const jsondiffpatchInstance = jsondiffpatch.create({
  // used to match objects when diffing arrays, by default only === operator is used
  objectHash: function (obj: any) {
    // this function is used only to when objects are not equal by ref
    return obj._id || obj.id;
  },
});

const saveDiffHistory = async (queryObject: any, currentObject: any) => {
  const queryUpdate: any = queryObject.getUpdate();
  const schemaOptions: any = queryObject.model.schema.options || {};

  let keysToBeModified: string[] = [];
  let mongoUpdateOperations: string[] = [];
  let plainKeys: string[] = [];

  for (const key in queryUpdate) {
    const value = queryUpdate[key];
    if (key.startsWith("$") && typeof value === "object") {
      const innerKeys = Object.keys(value);
      keysToBeModified = keysToBeModified.concat(innerKeys);
      if (key !== "$setOnInsert") {
        mongoUpdateOperations = mongoUpdateOperations.concat(key);
      }
    } else {
      keysToBeModified.push(key);
      plainKeys.push(key);
    }
  }
  let updatedObject = assign(
    { ...currentObject },
    pick(queryUpdate, mongoUpdateOperations),
    pick(queryUpdate, plainKeys)
  );

  let { strict } = queryObject.options || {};
  // strict in Query options can override schema option
  strict = strict !== undefined ? strict : schemaOptions.strict;

  if (strict === true) {
    const validPaths = Object.keys(queryObject.model.schema.paths);
    updatedObject = pick(updatedObject, validPaths);
  }

  return await saveDiffObject(currentObject, updatedObject);
};

const saveDiffs = async (queryObject: any) => {
  try {
    const doc = await queryObject.model.findOne(queryObject._conditions);
    await saveDiffHistory(queryObject, doc.toObject({ depopulate: true }));
  } catch (error) {
    console.error(error);
  }
};

async function saveDiffObject(currentObject: any, updated: any) {
  try {
    let diff = jsondiffpatchInstance.diff(
      JSON.parse(JSON.stringify(currentObject)),
      JSON.parse(JSON.stringify(updated))
    );

    const collectionId = currentObject._id;
    const collectionName = currentObject.constructor.modelName;
    const affectedColumns = diff ? Object.keys(diff) : [];
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

  schema.pre("findOneAndUpdate", async function (this, next) {
    try {
      await saveDiffs(this);
      next();
    } catch (error: any) {
      next(error);
    }
  });

  schema.pre("updateOne", async function (this, next) {
    try {
      await saveDiffs(this);
      next();
    } catch (error: any) {
      next(error);
    }
  });
}

export default lastModifiedPlugin;
