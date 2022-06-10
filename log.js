const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    user: {
        type: Number,
        required: true
    },
    action: {
        type: String,
        enum: ["register", "login"],
        default: "null",
        required: true
    },
    actionAppliesTo: {
        type: Number,
        required: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
},{
    versionKey: false
})

module.exports = mongoose.model("Log", logSchema)