import {
  findBetween,
  findById as findFriendshipById,
  createRequest,
  acceptRequest,
  deleteRequest,
  deleteBetween,
  listFriends,
  listIncomingRequests,
} from '../models/friendshipModel.js'
import {
  isBlocked,
  eitherBlocked,
  addBlock,
  removeBlock,
  listBlocks,
} from '../models/userBlockModel.js'
import { findRawById } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'

// 解析并校验目标玩家（须为存在的、正常状态的玩家 role=0，且非自己）。
// 不通过时已写响应并返回 null。
async function resolveTarget(req, res, rawId) {
  const targetId = Number(rawId)
  if (!Number.isInteger(targetId) || targetId <= 0) {
    res.status(400).json({ error: '目标道友无效' })
    return null
  }
  if (targetId === req.user.id) {
    res.status(400).json({ error: '不可对自己施为' })
    return null
  }
  const target = await findRawById(targetId)
  if (!target || target.role !== 0) {
    res.status(404).json({ error: '未寻得此道友' })
    return null
  }
  return target
}

/* ---------- 关系状态（ChatUserModal 打开时查询） ---------- */

// GET /api/user/relations/:userId — 我与某道友的关系概览（供名片按钮态判定）
export async function getRelation(req, res, next) {
  try {
    const targetId = Number(req.params.userId)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: '目标道友无效' })
    }
    if (targetId === req.user.id) {
      return res.json({ isSelf: true })
    }
    const [rel, blockedByMe, blockedMe] = await Promise.all([
      findBetween(req.user.id, targetId),
      isBlocked(req.user.id, targetId),
      isBlocked(targetId, req.user.id),
    ])

    let isFriend = false
    let outgoingPending = false
    let incomingRequestId = 0
    if (rel) {
      if (rel.status === 1) isFriend = true
      else if (rel.requester_id === req.user.id) outgoingPending = true
      else incomingRequestId = rel.id
    }

    res.json({
      isSelf: false,
      isFriend,
      outgoingPending,
      incomingRequestId,
      isBlockedByMe: blockedByMe,
      hasBlockedMe: blockedMe,
    })
  } catch (err) {
    next(err)
  }
}

/* ---------- 好友（结交） ---------- */

// GET /api/user/friends — 我的好友 + 收到的待通过请求
export async function getFriends(req, res, next) {
  try {
    const [friends, requests] = await Promise.all([
      listFriends(req.user.id),
      listIncomingRequests(req.user.id),
    ])
    res.json({ friends, requests })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/friends/request — { targetId } 发起结交
export async function requestFriend(req, res, next) {
  try {
    const target = await resolveTarget(req, res, req.body?.targetId)
    if (!target) return

    if (await eitherBlocked(req.user.id, target.id)) {
      return res.status(403).json({ error: '因拉黑关系，无法与此道友结交' })
    }
    const rel = await findBetween(req.user.id, target.id)
    if (rel) {
      if (rel.status === 1) return res.status(409).json({ error: '你们已是道友' })
      if (rel.requester_id === req.user.id) {
        return res.status(409).json({ error: '结交之邀已发出，静待回应' })
      }
      return res.status(409).json({ error: '此道友已向你发出结交之邀，请前往应允' })
    }

    await createRequest(req.user.id, target.id)
    await addLog(target.id, 'friend_request', `道友【${req.user.dao_name}】欲与你结交`)
    res.status(201).json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/friends/accept — { requestId } 应允结交
export async function acceptFriend(req, res, next) {
  try {
    const id = Number(req.body?.requestId)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '请求无效' })
    }
    const rel = await findFriendshipById(id)
    if (!rel || rel.addressee_id !== req.user.id || rel.status !== 0) {
      return res.status(404).json({ error: '该结交之邀已失效' })
    }
    const affected = await acceptRequest(id, req.user.id)
    if (!affected) return res.status(409).json({ error: '该结交之邀已失效' })

    await addLog(rel.requester_id, 'friend_accepted', `道友【${req.user.dao_name}】已应允你的结交之邀`)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/friends/reject — { requestId } 婉拒结交（删除待通过行）
export async function rejectFriend(req, res, next) {
  try {
    const id = Number(req.body?.requestId)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '请求无效' })
    }
    const rel = await findFriendshipById(id)
    if (!rel || rel.addressee_id !== req.user.id || rel.status !== 0) {
      return res.status(404).json({ error: '该结交之邀已失效' })
    }
    await deleteRequest(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/friends/remove — { targetId } 断交（删除好友关系）
export async function removeFriend(req, res, next) {
  try {
    const target = await resolveTarget(req, res, req.body?.targetId)
    if (!target) return
    await deleteBetween(req.user.id, target.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

/* ---------- 拉黑 ---------- */

// GET /api/user/blocks — 我的黑名单
export async function getBlocks(req, res, next) {
  try {
    res.json({ blocks: await listBlocks(req.user.id) })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/blocks — { targetId } 拉黑（并解除既有好友/请求关系）
export async function blockUser(req, res, next) {
  try {
    const target = await resolveTarget(req, res, req.body?.targetId)
    if (!target) return
    await addBlock(req.user.id, target.id)
    // 拉黑即断交：清除任一方向的好友或待通过请求
    await deleteBetween(req.user.id, target.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/blocks/remove — { targetId } 解除拉黑
export async function unblockUser(req, res, next) {
  try {
    const targetId = Number(req.body?.targetId)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: '目标道友无效' })
    }
    await removeBlock(req.user.id, targetId)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
