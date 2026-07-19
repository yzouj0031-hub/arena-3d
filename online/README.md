# Arena 3D 跨设备联机测试场

该页面使用现有 Supabase 项目的 Realtime Broadcast 与 Presence：

- 六位房间码
- 最多六人 Presence 房间成员
- 英雄选择、准备、房主开局
- 10Hz 玩家位置与朝向同步
- 攻击动作事件同步

这是联网链路验证版本，不把伤害和胜负交给客户端冒充“完整联机”。正式对局需要下一阶段的权威状态判定。

浏览器里只包含 Supabase publishable key。不要在前端加入 service role key。
