require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ClasseViva } = require("classeviva-apiv2");
const mysql = require('mysql');
const emoji = require('node-emoji');
const crypto = require("crypto");
const moment = require('moment'); 

const token = process.env.TOKEN;
const url = process.env.URL;
const key = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

const options = {
    webHook: {
        port: process.env.PORT,
    }
};
const bot = new TelegramBot(token, options);
bot.setWebHook(`${url}/bot${token}`);

let answerCallbacks = {};

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

bot.on('message', msg => {
    var callback = answerCallbacks[msg.chat.id];
    if (callback) {
        delete answerCallbacks[msg.chat.id];
        return callback(msg);
    }
});

bot.on("callback_query", callbackQuery => {
    let msg = callbackQuery.message;
    bot.answerCallbackQuery(callbackQuery.id).then(() => {
        if (callbackQuery.data == '1') {
            bot.sendMessage(msg.chat.id, 'Inserisci la nuova password:').then(() => {
                answerCallbacks[msg.chat.id] = answer => {
                    let sql = 'UPDATE users SET password=? WHERE id=?';
                    con.query(sql, [encrypt(answer.text), msg.chat.id], err => {
                        if (err) {
                            insertError(err);
                            bot.sendMessage(msg.chat.id, 'Aggiornamento della password non riuscito, riprova più tardi.');
                        }

                        else {
                            bot.sendMessage(msg.chat.id, 'Password cambiata correttamente, digita / per visualizzare i comandi');
                        }
                    });
                }
            });
        } else if (callbackQuery.data == '2') {
            bot.sendMessage(msg.chat.id, 'Inserisci la nuova email:').then(() => {
                answerCallbacks[msg.chat.id] = answer => {
                    let sql = 'UPDATE users SET email=? WHERE id=?';
                    con.query(sql, [answer.text, msg.chat.id], err => {
                        if (err) {
                            insertError(err);
                            bot.sendMessage(msg.chat.id, 'Aggiornamento della email non riuscito, riprova più tardi.');
                        }
                        else {
                            bot.sendMessage(msg.chat.id, 'Email cambiata correttamente, digita / per visualizzare i comandi');
                        }
                    });
                }
            });
        } else if (callbackQuery.data == '3') {
            bot.sendMessage(msg.chat.id, 'Puoi contattarmi qui: @alessandrooferrarii');
        } else if (callbackQuery.data == '4') {
            let sql = 'DELETE FROM statistics WHERE fk_user=?';
            con.query(sql, [msg.chat.id], err => {
                if (err) {
                    insertError(err);
                    bot.sendMessage(msg.chat.id, 'Cancellazione non riuscita, riprova più tardi');
                }
                else {
                    sql = 'DELETE FROM users WHERE id=?';
                    con.query(sql, [msg.chat.id], err => {
                        if (err) {
                            insertError(err);
                            bot.sendMessage(msg.chat.id, 'Cancellazione non riuscita, riprova più tardi');
                        }
                        else {
                            bot.sendMessage(msg.chat.id, 'Cancellazione riuscita!' + emoji.get('wave') + '\n' + 'Digita /accedi se vuoi accedere di nuovo.' + emoji.get('grin'));
                        }
                    });
                }
            });
        } else if (callbackQuery.data == '5') { }
    });
});

bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, 'Benvenuto ' + msg.from.first_name + emoji.get('grin')).then(() => {
        bot.sendMessage(msg.chat.id, 'Digita /accedi per accedere, altrimenti digita /help se hai bisogno di aiuto.').then(() => {
            let sql = 'SELECT * FROM users WHERE id=?';
            con.query(sql, [msg.chat.id], (err, results) => {
                if (err) {
                    insertError(err);
                    bot.sendMessage(msg.chat.id, 'Si è verificato un problema, riprova più tardi!');
                }
                else if (results[0] == null) {
                    sql = 'INSERT INTO users(id,logged) VALUES (?,?)';
                    con.query(sql, [msg.chat.id, false], err => {
                        if (err) {
                            insertError(err);
                            bot.sendMessage(msg.chat.id, 'Si è verificato un problema, riprova più tardi!');
                        }
                    });
                }
            });
        });
    });
});

bot.onText(/\/accedi/, msg => {
    let sql = 'SELECT * FROM users WHERE id=?';
    con.query(sql, [msg.chat.id], (err, results) => {
        if (err) {
            insertError(err);
            bot.sendMessage(msg.chat.id, 'Si è verificato un problema, riprova più tardi!');
        }
        else if (results[0] == null) {
            sql = 'INSERT INTO users(id,logged) VALUES (?,?)';
            con.query(sql, [msg.chat.id, false], err => {
                if (err) {
                    insertError(err);
                    bot.sendMessage(msg.chat.id, 'Si è verificato un problema, riprova più tardi!');
                }
                else {
                    login(msg.chat.id);
                }
            });
        } else if (results[0] != null) {
            login(msg.chat.id);
        }
    });
});

bot.onText(/\/voti/, msg => {
    operation('voti', msg.chat.id, null);
});

bot.onText(/\/profilo/, msg => {
    operation('profilo', msg.chat.id, null);
});

bot.onText(/\/note/, msg => {
    operation('note', msg.chat.id, null);
});

bot.onText(/\/oggi/, msg => {
    operation('oggi', msg.chat.id, moment().format('MM-DD-YYYY'));
});

bot.onText(/\/giorno/, msg => {
    bot.sendMessage(msg.chat.id, 'Inserisci la data in questo formato: ' + '\n' + 'mm/dd/yyyy').then(() => {
        answerCallbacks[msg.chat.id] = answer => {
            operation('giorno', msg.chat.id, answer.text);
        }
    });
});

bot.onText(/\/didattica/, msg => {
    operation('didattica', msg.chat.id, null);
});

bot.onText(/\/help/, msg => {
    bot.sendMessage(msg.chat.id, 'Di cosa hai bisogno?', {
        "reply_markup": {
            "inline_keyboard": [
                [
                    {
                        text: "Aggiorna password",
                        callback_data: "1",
                    },
                    {
                        text: "Aggiorna email",
                        callback_data: "2",
                    },
                    {
                        text: "Contattami",
                        callback_data: "3"
                    }
                ],
            ],
        },
    });
});

bot.onText(/\/logout/, msg => {
    bot.sendMessage(msg.chat.id, 'Le tue credenziali saranno rimosse SOLO dal database, e non da ClasseViva.' + '\n' + 'Vuoi continuare?', {
        "reply_markup": {
            "inline_keyboard": [
                [
                    {
                        text: "Sì",
                        callback_data: "4",
                    },
                    {
                        text: "No",
                        callback_data: "5"
                    },

                ],
            ],
        },
    });
});

function ClasseVivaSession(id, email, password, type, date) {

    ClasseViva.establishSession(email, password).then(async session => {

        let assignments = await session.getAssignments();
        let notes = await session.getNotes();
        let marks = await session.getMarks();
        let topics = await session.getToday(date);
        let profile = await session.getProfile();

        switch (type) {
            case 'note':
                if (notes.length == 0) {
                    bot.sendMessage(id, 'Non hai note, bravo!' + emoji.emojify(':sunglasses::clap:'));
                } else {
                    notes.forEach(element => {
                        bot.sendMessage(id, 'Insegnante: ' + element.teacher + '\n' + 'Descrizione: ' + element.content + '\n' + 'Data: ' + element.date + '\n');
                    });
                }
                break;
            case 'voti':
                marks.forEach(element => {
                    bot.sendMessage(id, 'Voto: ' + element.mark + '\n' + 'Materia: ' + element.subject + '\n' + 'Tipo: ' + element.type + 'Data: ' + element.date + emoji.get('book') + '\n');
                });
                break;
            case 'profilo':
                bot.sendPhoto(id, profile['pic']).then(() => {
                    bot.sendMessage(id, 'Nome: ' + profile['name'] + '\n' + 'Id: ' + profile['uid'] + '\n' + 'Scuola: ' + profile['schoolName']);
                });
                break;
            case 'oggi':
                let presences = topics['presences'];
                let subjects = topics['subjects'];
                if (presences.length == 0 && subjects.length == 0) {
                    bot.sendMessage(id, 'Oggi è il tuo giorno libero, goditelo!' + emoji.get('champagne'));
                } else {
                    let today = new Promise((resolve, reject) => {
                        presences.forEach((element, index, array) => {
                            bot.sendMessage(id, 'Presenza: ' + element.status + ' ' + element.length + ' ora/e');
                            if (index === array.length - 1) resolve();
                        });
                    });
                    today.then(() => {
                        subjects.forEach(element => {
                            bot.sendMessage(id, 'Insegnante: ' + element.teacherName + '\n' + 'Tipo: ' + element.lessonType.replace(':', '') + '\n' + 'Descrizione: ' + element.lessonArgument + '\n' + 'Materia: ' + element.subject + '\n' + 'Ora: ' + element.hour + '\n' + 'Durata:' + element.hoursDone + ' ora/e' + '\n');
                        });
                    });
                }
                break;
            case 'didattica':
                assignments.forEach(element => {
                    bot.sendMessage(id, 'Insegnante: ' + element.teacherName + '\n' + 'Descrizione: ' + element.assignmentTitle + '\n' + 'Data: ' + element.date + '\n');
                });
                break;
            case 'giorno':
                let presences_date = topics['presences'];
                let subjects_date = topics['subjects'];
                if (presences_date.length == 0 && subjects_date.length == 0) {
                    bot.sendMessage(id, 'Era il tuo giorno libero, te lo sarai goduto!' + emoji.get('champagne'));
                } else {
                    let today = new Promise((resolve, reject) => {
                        presences_date.forEach((element, index, array) => {
                            bot.sendMessage(id, 'Presenza: ' + element.status + ' ' + element.length + ' ora/e');
                            if (index === array.length - 1) resolve();
                        });
                    });
                    today.then(() => {
                        subjects_date.forEach(element => {
                            bot.sendMessage(id, 'Insegnante: ' + element.teacherName + '\n' + 'Tipo: ' + element.lessonType.replace(':', '') + '\n' + 'Descrizione: ' + element.lessonArgument + '\n' + 'Materia: ' + element.subject + '\n' + 'Ora: ' + element.hour + '\n' + 'Durata:' + element.hoursDone + ' ora/e' + '\n');
                        });
                    });
                }
                break;
            default:
                break;
        }

    }).catch(() => {
        bot.sendMessage(id, 'Credenziali non corrette o registro attualmente non raggiungibile.' + '\n' + 'Se hai problemi digita /help.');
    });
}

function operation(type, user, date) {
    getInfo(user, (id, logged) => {
        if (user == id && logged == 0) {
            bot.sendMessage(id, 'Prima devi accedere, digita /accedi per farlo.');
        } else if (user == id && logged == 1) {
            insertStatistics(type, user);
            getStatus(user, (id, email, password) => {
                ClasseVivaSession(id, email, decrypt(password), type, date);
                bot.sendMessage(id, 'Attendi...' + emoji.get('grin'));
            });
        }
    });
}

function getInfo(id, callback) {
    let sql = 'SELECT id,logged FROM users WHERE id=?';
    con.query(sql, [id], (err, results) => {
        if (err) {
            insertError(err);
            bot.sendMessage(id, 'Si è verificato un problema, riprova più tardi.' + '\n' + 'Digita /help se hai bisogno di aiuto.');
        }
        else {
            return callback(results[0].id, results[0].logged);
        }
    });
}

function getStatus(id, callback) {
    let sql = 'SELECT id,email,password FROM users WHERE id=?';
    con.query(sql, [id], (err, results) => {
        if (err) {
            insertError(err);
            bot.sendMessage(id, 'Si è verificato un problema, riprova più tardi.' + '\n' + 'Digita /help se hai bisogno di aiuto.');
        }
        return callback(results[0].id, results[0].email, results[0].password);
    });
}

function login(user) {
    getInfo(user, (id, logged) => {
        if (id == user && logged == 1)
            bot.sendMessage(user, 'Hai già effettuato l\'accesso, premi / per visualizzare i comandi.');
        else if (id == user && logged == 0) {
            bot.sendMessage(user, 'Inserisci la tua email:').then(() => {
                answerCallbacks[user] = answer => {
                    let email = answer.text;
                    sql = 'UPDATE users SET email=? WHERE id=?';
                    con.query(sql, [email, user], err => {
                        if (err) {
                            insertError(err);
                            bot.sendMessage(user, 'Si è verificato un problema con la registrazione!' + '\n' + 'Riprova più tardi, se hai bisogno digita /help');
                        }
                        else {
                            bot.sendMessage(user, 'Inserisci la tua password:').then(() => {
                                answerCallbacks[user] = answer => {
                                    let password = answer.text;
                                    sql = 'UPDATE users SET password=? WHERE id=?';
                                    con.query(sql, [encrypt(password), user], err => {
                                        if (err) {
                                            insertError(err);
                                            bot.sendMessage(user, 'Si è verificato un problema con la registrazione!' + '\n' + 'Riprova più tardi, se hai bisogno digita /help');
                                        }
                                        else {
                                            sql = 'UPDATE users SET logged=? WHERE id=?';
                                            con.query(sql, [true, user], err => {
                                                if (err) {
                                                    insertError(err);
                                                    bot.sendMessage(user, 'Si è verificato un problema con la registrazione!' + '\n' + 'Riprova più tardi, se hai bisogno digita /help');
                                                }
                                                else {
                                                    bot.sendMessage(user, 'Ora cosa vuoi fare?' + '\n' + 'Digita / per visualizzare i comandi.');
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function insertStatistics(type, id) {
    let date = moment().format('YYYY-MM-DD HH:mm:ss');
    sql = 'INSERT INTO statistics (request,date,fk_user) VALUES (?,?,?)';
    con.query(sql, [type, date, id], err => {
        if (err) {
            insertError(err);
        }
    });
}

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

function insertError(type) {
    let sql = 'INSERT INTO errors (type,date) VALUES (?,?)';
    let date = moment.format('YYYY-MM-DD HH:mm:ss');
    con.query(sql, [type, date]);
}
