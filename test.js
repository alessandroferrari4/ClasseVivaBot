require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ClasseViva } = require("classeviva-apiv2");
const moment = require('moment');
const bot = new TelegramBot(process.env.TOKEN, { polling: true });
const emoji = require('node-emoji');
const mysql = require('mysql');

const crypto = require("crypto");
const key = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

const con = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

con.connect(err => {
    if (err) {
        insertError(err);
        throw err;
    }
});

const express = require('express');
const app = express();
const path = require('path');
const public = path.join(__dirname, 'site/public');
const assets = path.join(__dirname, 'site/assets');
const private = path.join(__dirname, 'site/private');

app.use('/', express.static(assets));

app.get('/', (req, res) => {
    res.sendFile(path.join(public, 'index.html'));
});

app.get('/private', (req, res) => {
    con.query('SELECT password FROM users WHERE email=?', [req.query.email], (err, results) => {
        if (results[0] != null)
            if (decrypt(results[0].password) == req.query.password)
                res.sendFile(path.join(private, 'private.html'));
            else
                console.log('');
        else
            console.log('');
    });
});

app.listen(8080);


bot.onText(/\/start/, msg => {
    ClasseViva.establishSession('alessandro2002.af@gmail.com', 'Alessandro2002').then(async session => {
        let assignments = await session.getAssignments();
        let notes = await session.getNotes();
        let marks = await session.getMarks();
        let topics = await session.getToday('03/24/2021');
        let profile = await session.getProfile();
    });
});

function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}