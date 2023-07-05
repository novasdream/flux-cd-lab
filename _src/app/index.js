const express = require('express')
const app = express()
const port = 3000

app.use((req, res) => {
  const { path, method } = req;
  res.send({ path, method })
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})