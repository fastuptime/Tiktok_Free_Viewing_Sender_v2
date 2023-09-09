const user = new mongoose.Schema({
    id: { type: String, default: null },
    coin: { type: Number, default: 0 },
    logs: { type: Array, default: [] },
    getCoins: { type: Array, default: [] }
});

module.exports = mongoose.model("user", user);