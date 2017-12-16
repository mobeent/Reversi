'use strict'

const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/testreversi'

const http = require('http')
const fs = require('fs')
const jade = require('jade')

const server = http.createServer((request, response) => {
    if (request.url === '/reversiclient.js') {
        fs.readFile('reversiclient.js', 'utf-8', (err, data) =>
            response.end(data))
    } else {
        fs.readFile('reversi.jade', 'utf-8', (err, data) =>
            response.end(jade.compile(data)()))
    }
})

const portnumber = 8000
server.listen(portnumber, () => console.log('listening at localhost:8000'))

const io = require('socket.io')(server)

let users = 1
let flag = 0
const zero = 0
const one = 1
const waiting = []
const currentgames = []
const onehalf = []
// if one user check==0
// only when second user connects can a move be made
// when user two connects emit

io.sockets.on('connection', socket => {
    socket.on('gamealreadystarted', data => {
        MongoClient.connect(url, (err, db) => {
            console.log('mongo fetching')
            fetchinfo(db, data, (oldstate) => {
                db.close()
                checkotherhalf(socket, data)
                socket.emit('youroldstate', oldstate)
            })
        })
    })

    socket.emit('initialconnection', users)
    socket.on('gotusername', () => {
        if (users === one) {
            waiting.push(socket)
            users = 2
        } else {
            usertwoconnect(socket)
            users = 1
        }
    })

    socket.on('passingturn', data => {
        if (flag === one) {
            whichgame('GAME_FINISH', data, socket)
        } else {
            flag = 1
            whichgame('otheruserpassed', data, socket)
        }
    })

    socket.on('Game_Over', data => {
        MongoClient.connect(url, (err, db) => {
            console.log('mongo removing')
            removedocument(db, data, () => {
                db.close()
            })
        })
        whichgame('GAME_FINISH', data, socket)
    })

    socket.on('to_server', data => {
        MongoClient.connect(url, (err, db) => {
            console.log('mongo connected')
            insertDocument(db, data, socket, () => {
                db.close()
            })
        })
        whichgame('to_client', data, socket)
        flag = 0
    })

    socket.on('to_server_flip', data =>
        whichgame('to_client_flip', data, socket))

    socket.on('disconnect', () => {
        if (waiting[zero] === socket) {
            waiting.splice(zero, one)
            users = 1
        } else {
            disconnecting('disonnceteduser', socket)
        }
    })
})

function checkotherhalf(socket, mongo) {
    let found = 0
    for (let i = 0; i < onehalf.length; i++) {
        if (onehalf[i].mongoid === mongo) {
            console.log(mongo)
            console.log('found')
            console.log(onehalf[i].mongoid)
            found = 1
            currentgames.push({'firstplayer':socket,
                'secondplayer':onehalf[i].socket})
        }
    }
    if (found === zero) {
        onehalf.push({'socket':socket, 'mongoid':mongo})
    }
}

const removedocument = function(db, data, callback) {
    const cursor = db.collection('activegames').find()
    console.log(data.mongoid)
    cursor.each((err, doc) => {
        if (doc !== null) {
            if (data.mongoid.toString() === doc._id.toString()) {
                console.log('Removing!!!')
                db.collection('activegames').removeOne({'_id':doc._id}, () => {
                    callback()
                })
            }
        }
    })
}

const fetchinfo = function(db, mongo, callback) {
    const cursor = db.collection('activegames').find()
    console.log('fetch')
    console.log(mongo)
    cursor.each((err, doc) => {
        if (doc !== null) {
            if (mongo.toString() === doc._id.toString()) {
                // console.log(doc.board)
                // console.log(doc.turn)
                callback(doc)
            }
        }
    })
}

const insertDocument = function(db, data, socket, callback) {
    const cursor = db.collection('activegames').find()
    console.log(data.mongoid)
    cursor.each((err, doc) => {
        if (doc !== null) {
            // console.log(doc)
            if (data.mongoid.toString() === doc._id.toString()) {
                console.log('Updating!!!')
                db.collection('activegames').updateOne(
                    { '_id' : doc._id },
                    {
                        $set: { 'board': data.board, 'turn':data.turn },
                        $currentDate: { 'lastModified': true },
                    }, () => {
                        callback()
                    })
            }
        }
    })
    if (data.mongoid === zero) {
        console.log('Inserting document')
        const doc = {'board':data.board, 'turn':data.turn}
        db.collection('activegames').insertOne(doc, (err, result) => {
            console.log('Inserted a document into the restaurants collection.')
            console.log(result.insertedId)
            for (let i = 0; i < currentgames.length; i++) {
                if (currentgames[i].firstplayer === socket ||
                    currentgames[i].secondplayer === socket) {
                    currentgames[i].secondplayer.emit('mongodbid',
                    result.insertedId)
                    currentgames[i].firstplayer.emit('mongodbid',
                    result.insertedId)
                }
            }
            callback()
        })
    }
}

function disconnecting(stringtoemit, socket) {
    for (let i = 0; i < currentgames.length; i++) {
        if (currentgames[i].firstplayer === socket) {
            currentgames[i].secondplayer.emit(stringtoemit)
            currentgames[i].secondplayer.disconnect()
            currentgames.splice(i, one)
            break
        } else if (currentgames[i].secondplayer === socket) {
            currentgames[i].firstplayer.emit(stringtoemit)
            currentgames[i].firstplayer.disconnect()
            currentgames.splice(i, one)
            break
        }
    }
}

function whichgame(stringtoemit, data, socket) {
    if (stringtoemit !== 'GAME_FINISH') {
        for (let i = 0; i < currentgames.length; i++) {
            if (currentgames[i].firstplayer === socket) {
                currentgames[i].secondplayer.emit(stringtoemit, data)
            } else if (currentgames[i].secondplayer === socket) {
                currentgames[i].firstplayer.emit(stringtoemit, data)
            }
        }
    } else {
        for (let i = 0; i < currentgames.length; i++) {
            if (currentgames[i].firstplayer === socket ||
                currentgames[i].secondplayer === socket) {
                currentgames[i].secondplayer.emit(stringtoemit, data)
                currentgames[i].firstplayer.emit(stringtoemit, data)
                currentgames.splice(i, one)
            }
        }
    }
}

function usertwoconnect(socket) {
    currentgames.push({'firstplayer':waiting[zero],
        'secondplayer':socket})
    waiting[zero].emit('seconduserconnected')
    socket.emit('seconduserconnected')
    waiting.splice(zero, one)
    const data = {'board':initboard(), 'turn':1, 'mongoid':0}
    MongoClient.connect(url, (err, db) => {
        console.log('mongo connected')
        insertDocument(db, data, socket, () => {
            db.close()
        })
    })
}

const four = 4
const five = 5
const nine = 9
function initboard() {
    const board = []
    for (let i = 1; i < nine; i++) {
        for (let j = 1; j < nine; j++) {
            if (i === four && j === four) {
                board.push('P1')
            } else if (i === four && j === five) {
                board.push('P2')
            } else if (i === five && j === four) {
                board.push('P2')
            } else if (i === five && j === five) {
                board.push('P1')
            } else {
                board.push('')
            }
        }
    }
}