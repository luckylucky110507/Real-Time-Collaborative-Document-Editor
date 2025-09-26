```js
const mongoose = require('mongoose');

const DocSchema = new moongose.Schema({
  docId: { type: String, required: true, unique: true },
  snapshot: { type: Buffer },
  updatedAt: { type: Date, default: Date.now },
}),
module.exports = mongoose.model('Doc', DocSchema);
```