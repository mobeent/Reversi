/* global io, document, $ */
'use strict'

const socketio = io()
let mongo = 0
let user = 0
let turn = 1
let checkother = 0
let points = 2
let otherplayerpoints = 0
const zero = 0
const one = 1
const two = 2
const nine = 9
const directions = [{'x':1, 'y':0}, {'x':1, 'y':1}, {'x':0, 'y':1},
{'x':-1, 'y':1}, {'x':-1, 'y':0}, {'x':-1, 'y':-1}, {'x':0, 'y':-1},
{'x':1, 'y':-1}]
move()

socketio.on('connect', () => {
    if (mongo !== zero) {
        socketio.emit('gamealreadystarted', mongo)
    }
})

socketio.on('youroldstate', data => {
    turn = data.turn
    restoretable(data)
    if (user === turn) {
        document.getElementById('Turn').innerHTML =
            'Your Move!'
    } else {
        document.getElementById('Turn').innerHTML =
            'Waiting For Other Player to take Turn'
    }
})

function restoretable(data) {
    let count = 0
    for (let i = 1; i < nine; i++) {
        for (let j = 1; j < nine; j++) {
            $('#m' + s(i) + s(j)).html(data.board[count])
            count = count + one
        }
    }
}

socketio.on('mongodbid', mongoid => {
    mongo = mongoid
})

socketio.on('initialconnection', users => {
    if (mongo === zero) {
        user = users
        if (user === one) {
            check()
            document.getElementById('Turn').innerHTML =
                'Waiting for other player to connect...'
            socketio.emit('gotusername')
        } else {
            check()
            checkother = 1
            document.getElementById('Turn').innerHTML =
                'Waiting For Other Player to take Turn'
            socketio.emit('gotusername')
        }
    }
})

socketio.on('disonnceteduser', () => {
    document.getElementById('Turn').innerHTML =
        'Other User Disconnected, Connecting you out...'
})

socketio.on('seconduserconnected', () => {
    if (user === one && mongo === zero) {
        checkother = 1
        document.getElementById('Turn').innerHTML =
            'Your Move!'
    }
})

socketio.on('to_client', data => {
    move2(data.id, data.user, data.points)
})

socketio.on('to_client_flip', data => {
    move3(data.id, data.user)
})

socketio.on('otheruserpassed', data => {
    if (data.user !== user) {
        if (turn === two) {
            turn = one
        } else {
            turn = two
        }
        otherplayerpoints = data.points
        document.getElementById('Turn').innerHTML =
            'Your Move Other player Passed'
    }
})

socketio.on('GAME_FINISH', data => {
    if (data.user !== user) {
        otherplayerpoints = data.points
    }
    if (points < otherplayerpoints) {
        document.getElementById('Turn').innerHTML =
        'YOU LOSE, Points: ' + s(points) + '-' + s(otherplayerpoints)
    } else if (points === otherplayerpoints) {
        document.getElementById('Turn').innerHTML =
        'ITS A DRAW, Points: ' + s(points) + '-' + s(otherplayerpoints)
    } else {
        document.getElementById('Turn').innerHTML =
        'YOU WIN Congrats, Points: ' + s(points) + '-' + s(otherplayerpoints)
    }
})

$(() => {
    $('#passbutton').click(() => {
        if (turn === user) {
            if (turn === two) {
                turn = one
            } else {
                turn = two
            }
            document.getElementById('Turn').innerHTML =
                'Waiting For Other Player to take Turn'
            socketio.emit('passingturn', {'user':user, 'points':points,
                'board':checkboard(), 'turn':turn, 'mongoid':mongo})
        }
    })
})

// Function to flip
function move3(value, username) {
    if (username !== user) {
        points = points - one
        if (points === zero) {
            socketio.emit('Game_Over', {'user':user, 'points':points,
            'mongoid':mongo})
        }
        document.getElementById('m' + value).innerHTML =
            'P' + username.toString()
    }
}

// Function to propogate move
function move2(value, username, otherpoints) {
    if (username !== user) {
        if (turn === two) {
            turn = one
        } else {
            turn = two
        }
        otherplayerpoints = otherpoints
        document.getElementById('Turn').innerHTML =
            'Your Move'
        document.getElementById('m' + value).innerHTML =
            'P' + username.toString()
        const endgame = check()
        decisionmake(endgame)
    }
}

function decisionmake(endgame) {
    if (endgame.possiblemoves === zero) {
        document.getElementById('Turn').innerHTML =
            'YOU HAVE NO POSSIBLE MOVE PRESS PASS...'
    }
    if (endgame.boardfull === zero) {
        socketio.emit('Game_Over', {'user':user, 'points':points,
        'mongoid':mongo})
    }
}

function check() {
    let possiblemoves = 0
    for (let i = 1; i < nine; i++) {
        for (let j = 1; j < nine; j++) {
            for (let k = 0; k < directions.length; k++) {
                if ($('#m' + s(i) + s(j)).html() === '') {
                    if (chekmovement(i, j, zero, directions[k]) !== zero) {
                        possiblemoves = possiblemoves + one
                        break
                    }
                }
            }
        }
    }
    document.getElementById('numberofmoves').innerHTML =
        'Number of moves: ' + possiblemoves.toString()
    return {'possiblemoves':possiblemoves, 'boardfull':boardfull()}
}

function boardfull() {
    for (let i = 1; i < nine; i++) {
        for (let j = 1; j < nine; j++) {
            if ($('#m' + s(i) + s(j)).html() === '') {
                return one
            }
        }
    }
    return zero
}

function validmove(value) {
    let flipped = 0
    for (let i = 0; i < directions.length; i++) {
        const x = Number(value[zero])
        const y = Number(value[one])
        let count = 0
        count = chekmovement(x, y, count, directions[i])
        if (count !== zero) {
            flipped = flipped + one
            flip(x, y, directions[i], count)
        }
    }
    return flippedornot(flipped)
}

function flippedornot(flipped) {
    if (flipped === zero) {
        return {'valid':false}
    }
    check()
    return {'valid':true}
}

function flip(_x, _y, direction, count) {
    let x = _x
    let y = _y
    for (let i = 0; i < count; i++) {
        x = direction.x + x
        y = direction.y + y
        points = points + one
        document.getElementById('m' + x.toString() + y.toString()).innerHTML =
            'P' + user.toString()
        const value = x.toString() + y.toString()
        socketio.emit('to_server_flip', {'id':value, 'user':user})
    }
}

/*eslint-disable no-param-reassign*/
function chekmovement(x, y, count, direction) {
    while (one === one) {
        x = direction.x + x
        y = direction.y + y
        if (checkedge(x, y) || $('#m' + s(x) + s(y)).html() === '') {
            count = 0
            break
        }
        if ($('#m' + s(x) + s(y)).html() === 'P' + s(user)) {
            break
        }
        count = count + one
    }
    return count
}
/*eslint-enable no-param-reassign*/

function checkedge(x, y) {
    return y === nine || y === zero || x === zero || x === nine
}

function s(val) {
    return val.toString()
}

function move(value) {
    if (turn === user && checkother === one) {
        if ($('#m' + value).html() === '') {
            if (validmove(value.toString()).valid === true) {
                points = points + one
                document.getElementById('m' + value).innerHTML =
                    'P' + s(user)
                if (turn === two) {
                    turn = one
                } else {
                    turn = two
                }
                document.getElementById('Turn').innerHTML =
                    'Waiting For Other Player to take Turn'
                socketio.emit('to_server', {'id':value, 'user':user,
                'points':points, 'board':checkboard(), 'turn':turn,
                'mongoid':mongo})
            }
        }
    }
}

function checkboard() {
    const piecespositions = []
    for (let i = 1; i < nine; i++) {
        for (let j = 1; j < nine; j++) {
            piecespositions.push($('#m' + s(i) + s(j)).html())
        }
    }
    return piecespositions
}