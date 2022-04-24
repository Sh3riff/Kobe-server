require('dotenv').config()
const express = require('express') 
const mongoose = require('mongoose')
const uuid = require('uuid');
const dayjs = require('dayjs');

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const userSchema = new mongoose.Schema({
  displayName: String,
  email: String,
  photoURL: String,
  tasks: [],
  dateCreated: Date,
})

const User = mongoose.model('User', userSchema)


app.get('/', async (req, res) => {
  return res.status(200).json({message: 'hello world'})
})

app.get('/user/:email/:displayName/:photoURL', async (req, res) => {
  const {photoURL, displayName, email} = req.params
  // console.log({photoURL, displayName, email})
  // return
  try {
    const user = await User.findOne({ email }).lean()
    if(!user){
      const newUser = new User({email, displayName, photoURL, tasks: [], dateCreated: Date.now()})
      const user_ = await newUser.save()
      return res.status(200).json(user_)
    }  
    if (user.tasks.length === 0){
      return res.status(200).json(user)
    }
    const formattedTask = user.tasks.map(task => {
      if(task.score === 0) {
        return ({...task, updatedToday: false})
      } else {
        const daysLastUpdated = dayjs().diff(task.dateCreated, 'day');
        const formattedScore = task.score / (daysLastUpdated + 1);
        return ({
          ...task,
          score: formattedScore,
          updatedToday: daysLastUpdated === 0 ? true : false,
        })
      }
    })
    return res.status(200).json({...user, tasks: formattedTask})
  } catch (error) {
    res.status(500).json({ message: 'Server Error' })
  }

})

app.post('/task', async (req, res) => {
  const {taskName, email} = req.body

  try {
    const newTask = {
      name: taskName,
      id: uuid.v4(),
      dateCreated: Date.now(),
      score: 0,
    }
    const taskAdded = await User.findOneAndUpdate({email}, {$push: {tasks: newTask}},{ new: true }).lean()
    res.status(200).json(taskAdded)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server Error' })
  }

})

app.put('/task', async (req, res) => {
    const {taskId, email} = req.body
    try {
      const user = await User.findOne({email}).lean()
      // find task
      const thisTask = user.tasks.find(task => task.id === taskId);
      // never updated
      if(!thisTask?.lastUpdated){
        const daysLastUpdated = dayjs().diff(task.dateCreated, 'day');
        const newScore = daysLastUpdated === 0 ? 5 : 7;
        const updatedTask = await User.findOneAndUpdate(
          {email, 'tasks.id': taskId},
          { $set: { 'tasks.$.score': newScore, 'tasks.$.lastUpdated': Date.now()} },
          { new: true }
        ).lean()
        return res.status(200).json(updatedTask)
      }
      // updated today
      const today = dayjs();
      const taskLastUpdated = dayjs(thisTask.lastUpdated);
      const updatedToday = today.diff(taskLastUpdated, 'day') === 0 ? true : false;
      if(updatedToday){
        return res.status(200).json({})
      }
      // not updated today
      const dateCreated = thisTask.dateCreated;

      // do not worry about day 0, it would be handled @ !lastUpdated.
      const maxPrevScore = today.diff(dateCreated, 'day') * 5;

      const newScore = maxPrevScore === thisTask.score ?
        thisTask.score + 5 :
        maxPrevScore - thisTask.score === 1 ?
        thisTask.score + 6 : 
        thisTask.score + 7;
      
        const updatedTask = await User.findOneAndUpdate(
          {email, 'tasks.id': taskId},
          { $set: { 'tasks.$.score': newScore, 'tasks.$.lastUpdated': Date.now()} },
          { new: true }
        ).lean()
        return res.status(200).json(updatedTask)
      
    } catch (error) {
      res.status(500).json({ message: 'Server Error' })
    }
})
app.get('/kobe', async (req, res) => {

  // calc score
  const calcScore = (user) => {
    if(user.tasks.length === 0){
      let zero = 0;
      return zero.toFixed()
    }
    let totalScore = 0;
    let totalDays = 0;
    user.tasks.forEach(task => {
      totalScore += task.score;
      totalDays += dayjs().diff(dayjs(task.dateCreated), 'day') + 1 // acounting for today
    })
    return (totalScore / totalDays).toFixed(2)
  }
  // sort score
  const sortInDescendingOrder = (a, b) => {
      if (a.kobeScore === b.kobeScore) {
          return 0
      };
      const aArr = a.kobeScore.split("."), bArr = b.kobeScore.split(".");
    for (let i = 0; i < Math.min(aArr.length, bArr.length); i++) {
        if (parseInt(aArr[i]) > parseInt(bArr[i])) {
          return -1
        };
        if (parseInt(aArr[i]) < parseInt(bArr[i])) {
          return 1
        };
    }
    if (aArr.length > bArr.length) {
        return -1
    };
    if (aArr.length < bArr.length) {
        return 1
    };
    return 0;
  };
  try {
    const allUsers = await User.find().lean()
    const formatedUser = allUsers.map(user => ({
      name: user.displayName.split(' ')[0],
      id: user._id,
      photoURL: user.photoURL,
      email: user.email,
      kobeScore: calcScore(user),
    }))
    formatedUser.sort(sortInDescendingOrder)
    // list position
    let prevScore = 0
    let position = 0
    let prevPosition = 0
    const listWithposition = formatedUser.map((user, index) => {
      if (index === 0){
          prevScore = user.kobeScore
          position = index + 1
          prevPosition = index + 1
      }
      if (user.kobeScore !== prevScore){
          prevScore = user.kobeScore
          position = index + 1
          prevPosition = index + 1
      }
      if(user.kobeScore === prevScore){
          prevScore = user.kobeScore
          position = prevPosition
      }
      return {...user, position}
  })
    return res.status(200).json(listWithposition)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server Error' })
  }
  
})

app.listen(process.env.PORT || 5000, async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {useNewUrlParser: true})
    return console.log('server connected')
  } catch (error) {
    console.error('error connecting to DB', error)
  }
})
