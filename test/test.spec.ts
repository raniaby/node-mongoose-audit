import { expect } from "chai";
import mongoose from "mongoose";
import { historySchema } from "../src/model";
import lastModifiedPlugin, { saveDiffObject } from "../src/diffHistory";

const mockCurrentObject = {
  _id: "644d01d5c808dbd69b13c22e",
  key1: "originalValue1",
  key3: {
    a: "a",
    b: ["b", "c"],
  },
  key4: [
    {
      a: "a",
      b: "p",
    },
  ],
};

const mockUpdatedObject = {
  _id: "644d01d5c808dbd69b13c22e",
  key1: "originalValue1",
  key2: "value2",
  key3: {
    a: "a",
    b: ["b", "c"],
  },
  key4: [
    {
      a: "a",
      b: "b",
    },
  ],
};

describe("saveDiffObject function", () => {
  it("should return a history document", async () => {
    const history = await saveDiffObject(mockCurrentObject, mockUpdatedObject);
    expect(history).to.have.property("collectionId");
    expect(history).to.have.property("collectionName");
    expect(history).to.have.property("original");
    expect(history).to.have.property("updated");
    expect(history).to.have.property("affectedColumns");
    expect(history?.affectedColumns).to.have.members(["key2", "key4"]);
    expect(history).to.have.property("version");
  });
});

// Initialize Mongoose
before(async () => {
  await mongoose.connect("mongodb://localhost:27017/test");
  mongoose.model("History", historySchema);
  mongoose.plugin(lastModifiedPlugin);
});

// Clean up after tests
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
