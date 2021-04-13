const express = require('express')
const app = express()
const { v4: uuidv4 } = require('uuid')
const ioredis = require('ioredis')
const bodyParser = require('body-parser')
app.use(express.json())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
const redis = new ioredis({
  port: 6379,
  host: '113.31.144.189',
})
redis.on('error', error => {
  console.log(error)
})

// 扔一个漂流瓶
app.post('/bottle', async (req, res, next) => {
  try {
    const bottle = {
      ...req.body,
      time: Date.now(),
    }
    const bottleId = uuidv4()
    const type = {
      male: 0,
      female: 1,
    }
    // 根据漂流瓶类型的不同将漂流瓶保存到不同的数据库
    // 主要目的是为了方便使用 Redis 中的 RANDOMKEY 命令：该命令返回当前数据库中的一个随机键，不能加任何条件
    await redis.select(type[bottle.type])

    // 将数据存为哈希
    await redis.hmset(bottleId, bottle)

    // 设置漂流瓶生存期为 1 天
    await redis.expire(bottleId, 60 * 60 * 24)
    res.status(201).json({
      msg: 'success',
      code: 1,
      bottle: {
        id: bottleId,
        ...bottle,
      },
    })
  } catch (error) {
    next(error)
  }
})

// 捡一个漂流瓶
app.get('/bottle', async (req, res, next) => {
  try {
    const query = req.query
    const type = {
      all: Math.round(Math.random()),
      male: 0,
      femail: 1,
    }
    query.type = query.type || 'all'
    // 根据请求的瓶子类型到不同的数据库中取数据
    await redis.select(type[query.type])
    // 10% 几率捡到海星
    if (Math.random() <= 0.1) {
      return res.status(200).json({
        msg: '讨厌的海星...',
        code: 0,
      })
    }
    // 随机返回一个漂流瓶 ID
    const bottleId = await redis.randomkey()
    if (!bottleId) {
      return res.status(200).json({
        msg: '大海空空如也...',
        code: 0,
      })
    }
    // 根据漂流瓶 ID 获取完整的漂流瓶信息
    const bottle = await redis.hgetall(bottleId)
    res.status(200).json({
      bottle,
      code: 1,
    })
    // 从 Redis 中删除捡到的漂流瓶
    redis.del(bottleId)
  } catch (error) {
    next(error)
  }
})

// 统一处理异常
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
  })
})

app.listen(4000, () => {
  console.log('running...')
})
