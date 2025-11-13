import { Router } from 'express'
import { login } from '../controllers/auth.controller.js'


const router = Router()


// router.get('/auth', (req, res) => {
//   res.send('Ruta de autenticación')
// })      

router.post('/login', login)


export default router