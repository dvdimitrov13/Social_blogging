const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked')
const csrf = require('csurf')
const app = express()
const sanitizeHTML = require('sanitize-html')

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))

let sessionOptions = session({
    secret: "Sophie is a skinny legend",
    store: MongoStore.create({client: require('./db')}),
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60, httpOnly: true}
})

app.use(sessionOptions)
app.use(flash())


// with app.use this function will run for every request
// since its included before the router this info will be avaiilable to the router file
app.use(function(req, res, next) {
    // allow the use of Markdown from within ejs templates
    res.locals.filterUserHTML = function(content) {
        return markdown.parse(content)
    }

    // make flash messages availabe for every request
    res.locals.errors = req.flash("errors")  
    res.locals.success = req.flash("success")

    // make current user id available on the req object
    if (req.session.user) {
        req.visitorId = req.session.user._id
    } else {
        req.visitorId = 0
    }
    // this will be available in ejs templates
    res.locals.user = req.session.user
    next()
})

const router = require('./router')

app.use(express.static('public'))
app.set('views','views')
app.set('view engine', 'ejs')

app.use(csrf())

app.use(function(req, res, next) {
    res.locals.csrfToken = req.csrfToken()
    next()
})

app.use('/', router)

app.use(function(err, req, res, next) {
    if (err) {
        if (err.code == "EBADCSRFTOKEN") {
            req.flash("errors", "Cross site request forgery detected.")
            req.session.save(() => res.redirect('/'))
        } else {
            res.render('404')
        }
    }
})

const server = require('http').createServer(app)
const io = require('socket.io')(server)

io.use(function(socket, next) {
    sessionOptions(socket.request,socket.request.res, next)
})

io.on("connection", (socket) => {
    if (socket.request.session.user) {
        let user = socket.request.session.user

        socket.emit('welcome', {username: user.username, avatar: user.avatar})

        socket.on("chatMessageFromBrowser", function(data) {
            socket.broadcast.emit("chatMessageFromServer", {message: sanitizeHTML(data.message, {allowedTags: [], allowedAttributes: {}}), username: user.username, avatar: user.avatar})
        })
    }
})

module.exports = server