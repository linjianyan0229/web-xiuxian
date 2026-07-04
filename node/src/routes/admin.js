import { Router } from 'express'
import { adminAuthRequired } from '../middleware/adminAuth.js'
import { adminProfile } from '../controllers/adminAuthController.js'
import {
  dashboard,
  getUsers,
  setUserStatus,
  createUser,
  editUser,
  removeUser,
  getRealms,
  editRealm,
  rankings,
  getConfigs,
  updateConfigItem,
  setRealmSignIn,
} from '../controllers/adminController.js'
import { getPills, getPillMeta, editPill, editPillGrade } from '../controllers/pillController.js'

const router = Router()

// 全部需管理员鉴权（登录统一走 /api/auth/login，令牌带 role=admin）
router.get('/profile', adminAuthRequired, adminProfile)
router.get('/dashboard', adminAuthRequired, dashboard)
router.get('/users', adminAuthRequired, getUsers)
router.post('/users', adminAuthRequired, createUser)
router.put('/users/:id', adminAuthRequired, editUser)
router.delete('/users/:id', adminAuthRequired, removeUser)
router.patch('/users/:id/status', adminAuthRequired, setUserStatus)
router.get('/realms', adminAuthRequired, getRealms)
router.put('/realms/:id', adminAuthRequired, editRealm)
router.patch('/realms/:id/sign-in', adminAuthRequired, setRealmSignIn)
router.get('/rankings', adminAuthRequired, rankings)
// 系统配置列表
router.get('/configs', adminAuthRequired, getConfigs)
router.patch('/configs/:key', adminAuthRequired, updateConfigItem)
// 丹药管理（meta 需先于 :id 类路由声明）
router.get('/pills/meta', adminAuthRequired, getPillMeta)
router.get('/pills', adminAuthRequired, getPills)
router.put('/pills/:id', adminAuthRequired, editPill)
router.put('/pills/:id/grades/:grade', adminAuthRequired, editPillGrade)

export default router
