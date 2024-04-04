import { expect } from 'chai';
import mongoose from 'mongoose';
import { historySchema } from '../src/model'; 
import lastModifiedPlugin, {saveDiffObject} from '../src/diffHistory'; 


const mockCurrentObject = {
  _id: '644d01d5c808dbd69b13c22e',
  key1: 'originalValue1',
};

const mockUpdatedObject = {
  _id: '644d01d5c808dbd69b13c22e',
  key1: 'value1',
  key2: 'value2',
};

describe('saveDiffObject function', () => {
  it('should return a history document', async () => {
    const history = await saveDiffObject(mockCurrentObject, mockUpdatedObject);
    expect(history).to.have.property('collectionId');
    expect(history).to.have.property('collectionName');
    expect(history).to.have.property('original');
    expect(history).to.have.property('updated');
    expect(history).to.have.property('affectedColumns');
    expect(history?.affectedColumns).to.have.members(['key1', 'key2']);
    expect(history).to.have.property('version');
  });
});



// Initialize Mongoose
before(async () => {
  await mongoose.connect('mongodb://localhost:27017/test');
  mongoose.model('History', historySchema); 
  mongoose.plugin(lastModifiedPlugin); 
});

// Clean up after tests
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
