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
  try {
    const user = await User.findOne({ email }).lean()
    if(!user){
      const newUser = new User({email, displayName, photoURL, tasks: [], dateCreated: Date.now()})
      const user_ = await newUser.save()
      return res.status(200).json(user_)
    } else {
      return res.status(200).json(user)
    }
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
  /**
   * update user task
   * check for last updated
   *  if lastUpdated & today return
   *  if not lastUpdated add 5
   *  else calc
   * 
   */
    const {taskId, email} = req.body
    try {
      const user = await User.findOne({email}).lean()
      // find task
      const thisTask = user.tasks.find(task => task.id === taskId);
      // never updated
      if(!thisTask?.lastUpdated){
        const updatedTask = await User.findOneAndUpdate(
          {email, 'tasks.id': taskId},
          { $set: { 'tasks.$.score': 5, 'tasks.$.lastUpdated': Date.now()} },
          { new: true }
        ).lean()
        return res.status(200).json(updatedTask)
      }
      // updated today
      const today = dayjs();
      const taskLastUpdated = dayjs(thisTask.lastUpdated);
      const updatedToday = today.diff(taskLastUpdated, 'day') == 0 ? true : false;
      if(updatedToday){
        return res.status(200).json({})
      }
      // not updated today
      const dateCreated = thisTask.dateCreated;
      const maxPrevScore = today.diff(dateCreated) * 5 - 5; // minus today's score.

      const newScore = maxPrevScore >= thisTask.score ?
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

  const calcScore = (user) => {
    // console.log(user)
    // return
    if(user.tasks.length === 0){
      return 0
    }
    let totalScore = 0;
    let totalDays = 0;
    user.tasks.forEach(task => {
      totalScore += task.score;
      totalDays += dayjs().diff(dayjs(task.dateCreated), 'day') + 1 // acounting for today
    })
    return (totalScore / totalDays).toFixed(2)
  }
  try {
    const allUsers = await User.find().lean()
    console.log('user 1',allUsers[0]);
    const formatedUser = allUsers.map(user => ({
      name: user.displayName.split(' ')[0],
      photoURL: user.photoURL,
      kobeScore: calcScore(user),
    }))
    console.log('allUsers', formatedUser)
    return res.status(200).json(formatedUser)
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
