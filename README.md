# Database Audit Package

This package provides functionality for auditing database changes in mongoose.

## Installation

To install the package, run the following command:

```bash
npm install node-mongoose-audit
```

## Setting up Database Connection

```js
import { initConnection } from node-mongoose-audit; 
```
Provide Database Uri
```js
initConnection(uri);
```

## Usage
```js
import mongoose from 'mongoose';
import diffHistory from 'node-mongoose-audit';
 
const testSchema = new mongoose.Schema({
    someField: String,
    some: {
        deepField: String
    }
});
 
testSchema.plugin(diffHistory);
```

