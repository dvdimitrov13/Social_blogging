const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked')
const app = express()

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

app.use(express.urlencoded({extended:false})) //boilerplate - allows reading request.body
app.use(express.json())


app.use(express.static('public'))
app.set('views','views')
app.set('view engine', 'ejs')

app.use('/', router)

const server = require('http').createServer(app)

const io = require('socket.io')(server)

io.on("connection", (socket) => {
    socket.on("chatMessageFromBrowser", function(data) {
        io.emit("chatMessageFromServer", {message: data.message})
    })
})

module.exports = server