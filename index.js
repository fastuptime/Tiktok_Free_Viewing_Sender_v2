const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const ejs = require('ejs');
const app = express();
const cookieParser = require('cookie-parser');
const axios = require('axios');
global.mongoose = require('mongoose');
mongoose.connect(config.mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
global.db = require('./model/user');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', __dirname);

app.use(async (req, res, next) => {
    if (!req.cookies.userID) {
        let id = 'id_' + Math.random().toString(36).substring(2, 15);
        res.cookie('userID', id, { maxAge: 1000 * 60 * 60 * 24 * 365 });
        new db({ id: id, coin: 0, logs: [], getCoins: [] }).save();
    } else {
        let user = await db.findOne({ id: req.cookies.userID });
        if (!user) {
            let id = 'id_' + Math.random().toString(36).substring(2, 15);
            res.cookie('userID', id, { maxAge: 1000 * 60 * 60 * 24 * 365 });
            new db({ id: id, coin: 0, logs: [], getCoins: [] }).save();
        }
    }
    res.locals.adsCoin = config.adsCoin;
    res.locals.buyCoin = config.buyCoin;
    res.locals.sendCount = config.sendCount;
    next();
});

app.get('/', async (req, res) => {
    let user = await db.findOne({ id: req.cookies.userID });
    if (!user) return res.send('<script>window.location.href="/";</script>');
    res.render('index.ejs', {
        user
    });
});

app.get('/getcoins', async (req, res) => {
    let user = await db.findOne({ id: req.cookies.userID });
    if (!user) return res.json({ error: true, message: 'Hesabınız bulunamadı.' });
    let code = 'code_' + Math.random().toString(36).substring(2, 15);
    user.getCoins.push({ code: code, date: new Date() });
    let r = await axios.get(`https://ay.live/api/?api=${config.apiKey}&url=${config.url}?code=${code}&ct=1`).catch(err => { return res.json({ error: true, message: 'Bir hata oluştu.' }); });
    r = r.data;
    user.save();
    if (r.status == 'success') return res.redirect(r.shortenedUrl);
    return res.json({ error: true, message: 'Bir hata oluştu.' });
});

app.get('/callback', async (req, res) => {
    let code = req.query.code;
    if (!code) return res.json({ error: true, message: 'Bir hata oluştu. 1' });
    let user = await db.findOne({ id: req.cookies.userID });
    if (!user) return res.json({ error: true, message: 'Hesabınız bulunamadı.' });
    let getCoins = await db.findOne({ id: req.cookies.userID, getCoins: { $elemMatch: { code: code } } });
    if (!getCoins) return res.json({ error: true, message: 'Bir hata oluştu. 2' });
    db.findOneAndUpdate({ id: req.cookies.userID }, { 
        $inc: { coin: config.adsCoin }, 
        $push: { logs: { type: 'getCoin', coin: config.adsCoin, date: new Date() } },
        $pull: { getCoins: { code: code } }
    }).exec();
    return res.redirect(`/?success=true&message=Hesabınıza ${config.adsCoin} coin eklendi.`);
});

app.post('/send', async (req, res) => {
    let user = await db.findOne({ id: req.cookies.userID });
    if (!user) return res.json({ error: true, message: 'Hesabınız bulunamadı.' });
    let url = req.body.videourl;
    if (!url) return res.redirect(`/?error=true&message=Video urlsi giriniz.`);
    if (!url.includes('tiktok.com')) return res.redirect(`/?error=true&message=Geçersiz video urlsi.`);
    if (user.coin < config.buyCoin) return res.redirect(`/?error=true&message=Hesabınızda yeterli coin bulunmuyor.`);
    axios('https://igresellers.com/api/v2', {
        method: 'POST',
        data: {
            key: config.smmApiKey,
            action: 'add',
            service: config.serviceID,
            link: url,
            quantity: config.sendCount
        }
    }).then(async r => {
        r = r.data;
        await db.findOneAndUpdate({ id: req.cookies.userID }, {
            $inc: { coin: -config.buyCoin },
            $push: { logs: { type: 'send', coin: config.buyCoin, date: new Date(), order: r.order } }
        }).exec();
        return res.redirect(`/?success=true&message=İşlem başarılı. İzlenme gönderiliyor sipariş numaranız: ${r.order}`);
    }).catch(err => {
        return res.redirect(`/?error=true&message=İşlem başarısız. ${err.response.data.message}`);
    });
});


app.listen(config.port, () => {
    console.log(`İzlenme gönderme uygulaması ${config.port} portunda çalışıyor.`);
});
