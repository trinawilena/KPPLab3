const history = require('connect-history-api-fallback')
const bodyParser = require('body-parser')
const session = require('cookie-session')
const mongoose = require('mongoose')
const express = require('express')
const cors = require('cors')
const sha1 = require('sha1')
const salt = "ojfdngjfld"

const app = express()

app.use(
	session({
		name: 'session',
		keys: ['sdgrfdvddasq4t3e', 'hk4o5hgnewlkdvnfdhbi'],
		cookie: {
			secure: true,
			expires: 172800
		},
	}),
)

app.use(express.json())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())

const User = mongoose.model('User', new mongoose.Schema({
	email: {
		type: String,
		unique: true,
	},
	password: String,
	isAdmin: { type: Boolean, default: false }
}))
const Post = mongoose.model('Post', new mongoose.Schema({
	content: String,
	date: Date,
	title: String
}))

const voteSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
})
voteSchema.index({ user: 1, post: 1 }, { unique: true })
const Vote = mongoose.model('Vote', voteSchema)

app.get('/user', async (req, res) => {
	if (req.session.userid) {
		const user = await User.findById(req.session.userid).catch(() => { return false })

		if (user) {
			res.status(200).send({
				email: user.email,
				isAdmin: user.isAdmin
			})
			return
		}
	}
	res.sendStatus(401)
})
app.post("/user/register", async (req, res) => {
	const newUser = new User({
		email: req.body.email.toLowerCase(),
		password: sha1(salt + req.body.password + salt)
	})

	const result = await newUser.save().catch(() => { return false })
	if (result) {
		req.session.userid = result._id
		res.status(200).send(result.email)
		return
	}
	res.sendStatus(400)
})
app.post("/user/login", async (req, res) => {
	const result = await User.findOne({
		email: req.body.email.toLowerCase(),
		password: sha1(salt + req.body.password + salt)
	}).catch(() => { return false })

	if (result) {
		req.session.userid = result._id
		res.status(200).send({
			email: result.email,
			isAdmin: result.isAdmin
		})
		return
	}
	res.sendStatus(400)
})
app.post("/user/logout", (req, res) => {
	req.session.userid = false
	res.sendStatus(200)
})

app.get("/post/list", async (req, res) => {
	let postList = await Post.find().populate("votes").catch(() => { return false })
	let result = [] // copy

	if (!postList) { res.status(200).send([]); return }

	for (const k in postList) {
		const count = await Vote.countDocuments({ post: postList[k]._id }) || 0
		const postElement = postList[k]

		// copy all rows
		result[k] = {
			votes: count,
			_id: postElement._id,
			date: postElement.date,
			title: postElement.title,
			content: postElement.content,
		}
	}

	if (req.session.userid) {
		const voteList = await Vote.find({ user: req.session.userid }).catch(() => { return false })
		voteList.forEach(voteObject => {
			for (let k in result) {
				if (result[k]._id.toString() === voteObject.post.toString()) {
					result[k].voted = true
				}
			}
		});
	}

	res.status(200).send(result)
})
app.post("/post/vote", async (req, res) => {
	if (!req.session.userid || !await User.findById(req.session.userid)) {
		res.sendStatus(401)
		return false
	}
	if (!req.body.postID || !await Post.findById(req.body.postID)) {
		res.sendStatus(400)
		return
	}

	const vote = await Vote.findOneAndDelete({
		user: req.session.userid,
		post: req.body.postID
	})

	if (!vote) {
		await new Vote({
			user: req.session.userid,
			post: req.body.postID
		}).save();
	}

	res.status(200).send([
		await Vote.countDocuments({ post: req.body.postID }) || 0,
		vote ? false : true
	])
})

app.post("/post/admin/delete", async (req, res) => {
	if (!(await User.findById(req.session.userid))?.isAdmin) {
		res.sendStatus(401)
		return false
	}
	if (!req.body.postID) {
		res.sendStatus(400)
		return
	}

	await Post.findByIdAndRemove(req.body.postID)
	await Vote.deleteMany({ post: req.body.postID })
	res.sendStatus(200)
})
app.post("/post/admin/create", async (req, res) => {
	if (!(await User.findById(req.session.userid))?.isAdmin) {
		res.sendStatus(401)
		return false
	}
	if (!req.body.content || !req.body.title) { res.sendStatus(400); return }

	await new Post({
		content: req.body.content,
		title: req.body.title,
		date: new Date(),
	}).save()

	res.sendStatus(200)
})

process.openStdin().addListener("data", async function (d) {
	const cmdPattern = /\/(?<cmd>\w+) (?<args>.*)/ig
	const { cmd, args } = cmdPattern.exec(d.toString())?.groups || {}

	if (!cmd) {
		console.log("Forgot about slash '/' ?")
		return
	}

	if (cmd == "addadmin") {
		const result = await User.updateOne({
			email: args,
		}, {
			isAdmin: true
		})

		if (result.ok) {
			console.log(`> ${args} added to admin group`)
		} else {
			console.log("> Invalid email")
		}
	} else if (cmd == "deladmin") {
		const result = await User.updateOne({
			email: args,
			isAdmin: true
		}, {
			isAdmin: false
		})

		if (result.ok) {
			console.log(`> ${args} deleted from admin group`)
		} else {
			console.log("> Invalid email")
		}
	} else {
		console.log("> Unknown command;\n> Command list: /addadmin, /deladmin")
	}
});

app.use(history())
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/dist/index.html')
})

mongoose
	.connect('mongodb+srv://kate:123@cluster0.m6mfp.mongodb.net/votes', {
		useUnifiedTopology: true,
		useNewUrlParser: true,
	})
	.then(() => {
		app.listen(5000)
	})
