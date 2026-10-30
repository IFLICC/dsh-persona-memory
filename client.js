window.__ModuleLoader__.load({
  id: '@local/dsh-persona-memory',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const NS = 'persona-memory'
    const API = '/api/dsh-persona-memory'

    const DICTS = {
      zh: {
        title: '人格记忆',
        desc: '保持人设、按遗忘曲线记住事情，并在需要时写日记。',
        'tab.persona': '人设',
        'tab.memory': '记忆',
        'tab.diary': '日记',
        'tab.library': '资料库',
        'tab.scope': '范围',
        'tab.options': '设置',
        'mode.on': '人设模式已开启',
        'mode.off': '人设模式已关闭',
        'mode.toggle': '切换人设模式',
        'mode.hint': '开启后，人物卡与记忆会在每次对话中自然生效。',
        'mode.perChat': '人设按对话开启',
        'mode.perChatHint': '在输入框下方或新会话行点开关，只影响当前对话；换对话不会跟着变。',
        'mode.perChatCount': '已开启 {count} 个对话；点对话里的开关只改当前这个。',
        'mode.clearAll': '全部关闭',
        'card.active': '当前人物卡',
        'card.name': '名字',
        'card.title': '身份 / 称谓',
        'card.desc': '人格描述',
        'card.style': '说话风格',
        'card.rules': '行为准则（每行一条）',
        'card.greeting': '开场白',
        'card.new': '新建人物卡',
        'card.defaultName': '新人物卡',
        'card.copy': '复制当前卡',
        'card.delete': '删除',
        'card.deleteConfirm': '确定删除这张人物卡吗？它的全部记忆、日记和资料库也会一起删除。',
        'card.traits': '表现权重',
        'card.traitsHint': '0 表示关闭，50 是默认，100 表示强烈。数值会影响提示词里的语气约束。',
        'card.sections': '人物卡条目',
        'card.sectionsHint': '每个条目会以【标题】内容的形式进入提示词；可以自定义标题（口癖、世界观、禁忌等），也可以删除或调整顺序。',
        'card.addSection': '添加条目',
        'card.sectionPlaceholder': '条目标题，例如：口癖 / 世界观 / 禁忌',
        'card.contentPlaceholder': '这个条目的具体内容…',
        'card.sectionsEmpty': '还没有条目。点「添加条目」自定义人物卡的描述、风格或规则。',
        'card.up': '上移',
        'card.down': '下移',
        'trait.humanize': '拟人度',
        'trait.memes': '玩梗',
        'trait.emotion': '情绪',
        'trait.actions': '动作描写',
        'trait.initiative': '主动性',
        'trait.teasing': '吐槽',
        'card.unsaved': '有未保存的修改',
        'card.savedAt': '已保存',
        'mem.total': '记忆',
        'mem.due': '待复习',
        'mem.avg': '平均清晰度',
        'mem.forgotten': '已遗忘',
        'mem.add': '记住一件事',
        'mem.placeholder': '例如：用户养了一只叫豆豆的橘猫，怕打雷。',
        'mem.tags': '标签（逗号分隔）',
        'mem.importance': '重要度',
        'mem.search': '搜索记忆',
        'mem.empty': '还没有记忆。聊到值得记住的事时，它会被记下来。',
        'mem.noneMatch': '没有匹配的记忆。',
        'mem.review': '复习',
        'mem.reviewDue': '复习待复习的',
        'mem.pin': '置顶',
        'mem.unpin': '取消置顶',
        'mem.forget': '遗忘',
        'mem.restore': '恢复',
        'mem.archived': '已遗忘的记忆',
        'mem.archivedHint': '清晰度低于阈值后会自动移到这里，可以恢复。',
        'mem.retention': '清晰度',
        'mem.importanceValue': '重要度',
        'mem.cardHint': '记忆跟着人物卡走：当前显示的是「{name}」的记忆，切换人物卡会切换到对应的记忆。',
        'mem.clear': '清空此卡的记忆',
        'mem.clearConfirm': '确定清空这张人物卡的全部记忆（含已遗忘）吗？此操作不可撤销。',
        'mem.ioNote': '导入 / 导出只针对当前人物卡的记忆。',
        'diary.enabled': '日记功能',
        'diary.enabledHint': '允许模型在对话自然收束时写一篇简短日记。',
        'diary.auto': '自动摘要',
        'diary.autoHint': '每轮结束后，把你说过的要点自动记成当天的一篇日记（本地生成，不消耗模型调用）。',
        'diary.empty': '日记本还是空的。',
        'diary.write': '写一篇',
        'diary.titlePlaceholder': '标题',
        'diary.bodyPlaceholder': '今天发生了什么？',
        'diary.source.model': '模型',
        'diary.source.local': '自动摘要',
        'diary.source.manual': '手写',
        'diary.deleteConfirm': '确定删除这篇日记吗？',
        'diary.cardHint': '日记也跟着人物卡走：当前显示的是「{name}」的日记，切换人物卡会切到对应的日记。',
        'diary.ioNote': '导入 / 导出只针对当前人物卡的日记。',
        'lib.add': '新增一条资料',
        'lib.edit': '编辑资料',
        'lib.title': '标题',
        'lib.titlePlaceholder': '例如：梗「绷不住了」/ 某个知识点',
        'lib.kind': '类型',
        'lib.kind.meme': '梗',
        'lib.kind.knowledge': '知识',
        'lib.kind.reference': '资料',
        'lib.kind.note': '笔记',
        'lib.content': '内容',
        'lib.contentPlaceholder': '记录这个梗的用法、知识点的解释，或者从网上查到的资料…',
        'lib.tags': '标签（逗号分隔）',
        'lib.url': '来源链接',
        'lib.urlPlaceholder': 'https://…',
        'lib.search': '搜索资料',
        'lib.empty': '资料库还是空的。聊天里遇到的梗、知识，或上网查到的资料，都可以记在这里。',
        'lib.noneMatch': '没有匹配的资料。',
        'lib.save': '保存修改',
        'lib.addBtn': '存入资料库',
        'lib.needContent': '标题或内容至少填一项。',
        'lib.editBtn': '编辑',
        'lib.deleteConfirm': '确定删除这条资料吗？',
        'lib.clear': '清空此卡资料',
        'lib.clearConfirm': '确定清空当前人物卡的全部资料吗？此操作不可撤销。',
        'lib.cardHint': '资料库跟着人物卡走：当前显示的是「{name}」的资料库，切换人物卡会切换到对应的资料。',
        'lib.ioNote': '导入 / 导出只针对当前人物卡的资料库。',
        'lib.source.manual': '手动',
        'lib.source.model': '模型',
        'lib.source.web': '网页',
        'lib.source.import': '导入',
        'lib.updated': '更新于 {time}',
        'notice.libSaved': '资料已存入。',
        'notice.libUpdated': '资料已更新。',
        'notice.libDeleted': '资料已删除。',
        'notice.libCleared': '已清空当前人物卡的资料库。',
        'update.title': '版本与更新',
        'update.hint': '从 GitHub 的 main 分支读取 package.json 的 version 做比较；只检查，不会自动安装。',
        'update.current': '当前版本 v{version}',
        'update.check': '检查更新',
        'update.checking': '检查中…',
        'update.idle': '检查 GitHub 上是否有新版本。',
        'update.available': '发现新版本 v{version}',
        'update.upToDate': '已是最新版本',
        'update.failed': '检查失败',
        'update.repo': '打开仓库',
        'update.howto': '更新方式：在插件页重新安装这个 GitHub 仓库，或对本地目录 git pull 后重新加载/重启 DSH。',
        'opt.topK': '每次注入的记忆条数',
        'opt.title': '参数',
        'opt.topKHint': '越少越省 token，越多越容易想起旧事。',
        'opt.threshold': '遗忘阈值（%）',
        'opt.thresholdHint': '清晰度低于此值的记忆会被移到「已遗忘」，不再注入提示词。',
        'opt.max': '记忆上限',
        'opt.maxHint': '超出后优先保留清晰且重要的记忆。',
        'opt.storage': '数据文件',
        'opt.curve': '记忆按艾宾浩斯遗忘曲线衰减：刚记住时衰减较慢，越久不回顾掉得越快；每次复习或自然想起都会延长保留时间，重要的事还可以置顶。',
        'btn.save': '保存',
        'btn.add': '添加',
        'btn.delete': '删除',
        'btn.cancel': '取消',
        'btn.close': '关闭',
        'btn.refresh': '刷新',
        'btn.saving': '保存中…',
        'notice.modeOn': '人设模式已开启。',
        'notice.modeOff': '人设模式已关闭。',
        'notice.cardSaved': '人物卡已保存。',
        'notice.cardDeleted': '人物卡已删除。',
        'notice.memSaved': '已记住。',
        'notice.reviewed': '已加深记忆。',
        'notice.diarySaved': '日记已保存。',
        'notice.deleted': '已删除。',
        'notice.settingsSaved': '设置已保存。',
        'notice.cleared': '已关闭所有对话的人设模式。',
        'notice.memCleared': '已清空当前人物卡的记忆。',
        'notice.failed': '操作失败',
        'chip.on': '人设 · {name}',
        'chip.off': '本对话未开人设',
        'menu.current': '当前：{name}',
        'menu.currentOff': '本对话未开启人设',
        'menu.turnOff': '关闭本对话人设',
        'menu.turnOn': '开启本对话人设',
        'menu.switchCard': '切换人物卡（记忆跟随切换）',
        'chip.stateOn': '开',
        'chip.stateOff': '关',
        'chip.tip': '左键开关本对话的人设，右键选择人物卡',
        'chip.offScope': '此对话未启用人设',
        'menu.globalOn': '打开全局人设',
        'menu.globalOff': '关闭全局人设',
        'scope.title': '生效范围',
        'scope.desc': '主开关打开时，只有符合下面范围的对话才会带上人设与记忆；范围外的对话保持普通助手的样子。',
        'scope.mode.all': '全部对话',
        'scope.mode.workspaces': '指定工作区',
        'scope.mode.sessions': '指定对话',
        'scope.workspaces': '工作区',
        'scope.sessions': '打开中的对话',
        'scope.workspacesEmpty': '还没有登记工作区。在侧边栏打开或新建工作区后，这里会出现。',
        'scope.sessionsEmpty': '当前没有打开的对话。',
        'scope.workspacesHint': '选中工作区下的所有对话都会启用（含以后新建的对话）。',
        'scope.sessionsHint': '只让勾选的对话启用；对话关闭后仍保留勾选。',
        'scope.masterOff': '人设模式总开关是关闭的，范围设置暂时不生效。',
        'scope.overrideOn': '强制开启',
        'scope.overrideOff': '强制关闭',
        'scope.overrideInherit': '跟随范围',
        'scope.follow': '跟随范围设置',
        'scope.on': '在此对话开启',
        'scope.off': '在此对话关闭',
        'scope.clearOverride': '清除覆盖',
        'scope.precedence': '优先级：单对话覆盖 > 生效范围；主开关关闭时全部不生效。',
        'notice.scopeSaved': '范围已更新。',
        'io.export': '导出',
        'io.cards': '人物卡',
        'switch.on': '开',
        'switch.off': '关',
        'io.import': '导入',
        'io.exportAll': '导出全部备份',
        'io.importAll': '导入全部备份',
        'io.exported': '已导出文件。',
        'io.invalid': '文件不是有效的 JSON。',
        'io.tooLarge': '文件太大（上限 8MB）。',
        'io.merge': '合并导入',
        'io.replace': '覆盖导入',
        'io.merged': '已合并导入。',
        'io.replaced': '已覆盖导入。',
        'io.done': '导入完成。',
        'io.failed': '导出失败。',
        'io.hint': '导出为 JSON 文件；导入时可选择合并或覆盖。',
        'io.scopeNote': '导入备份不会自动启用范围设置以外的对话。',
        'age.today': '今天',
        'age.yesterday': '昨天',
        'age.days': '{count} 天前',
        'retention.clear': '清晰',
        'retention.recalled': '还记得',
        'retention.fuzzy': '模糊',
        'retention.fading': '快要忘记',
        loading: '加载中…',
        'badge.pinned': '置顶',
        'badge.due': '待复习',
        'unit.days': '天',
        'unit.percent': '%'
      },
      en: {
        title: 'Persona Memory',
        desc: 'Keep a character persona, retain facts on a forgetting curve, and keep a diary.',
        'tab.persona': 'Persona',
        'tab.memory': 'Memory',
        'tab.diary': 'Diary',
        'tab.library': 'Library',
        'tab.scope': 'Scope',
        'tab.options': 'Options',
        'mode.on': 'Persona mode is on',
        'mode.off': 'Persona mode is off',
        'mode.toggle': 'Toggle persona mode',
        'mode.hint': 'When on, the character card and memories join every conversation.',
        'mode.perChat': 'Persona is per chat',
        'mode.perChatHint': 'Use the switch below the composer or in the new-chat row; it only affects that chat.',
        'mode.perChatCount': 'On in {count} chats; the switch only changes the current one.',
        'mode.clearAll': 'Turn all off',
        'card.active': 'Active character',
        'card.name': 'Name',
        'card.title': 'Role / title',
        'card.desc': 'Personality',
        'card.style': 'Speaking style',
        'card.rules': 'Rules (one per line)',
        'card.greeting': 'Opening line',
        'card.new': 'New character',
        'card.defaultName': 'New character',
        'card.copy': 'Duplicate',
        'card.delete': 'Delete',
        'card.deleteConfirm': 'Delete this character card? All of its memories, diaries, and library entries will be deleted too.',
        'card.traits': 'Behavior weights',
        'card.traitsHint': '0 disables it, 50 is the default, 100 is strong. The numbers shape the prompt guidance.',
        'card.sections': 'Character sections',
        'card.sectionsHint': 'Each section enters the prompt as 【title】 content. Custom titles (verbal tic, worldview, taboos…) are allowed, and you can delete or reorder them.',
        'card.addSection': 'Add section',
        'card.sectionPlaceholder': 'Section title, e.g. verbal tic / worldview / taboos',
        'card.contentPlaceholder': 'What this section should say…',
        'card.sectionsEmpty': 'No sections yet. Add one to describe the character in your own words.',
        'card.up': 'Move up',
        'card.down': 'Move down',
        'trait.humanize': 'Human-ness',
        'trait.memes': 'Memes',
        'trait.emotion': 'Emotion',
        'trait.actions': 'Action asides',
        'trait.initiative': 'Initiative',
        'trait.teasing': 'Teasing',
        'card.unsaved': 'Unsaved changes',
        'card.savedAt': 'Saved',
        'mem.total': 'Memories',
        'mem.due': 'Due',
        'mem.avg': 'Avg. clarity',
        'mem.forgotten': 'Forgotten',
        'mem.add': 'Remember something',
        'mem.placeholder': 'e.g. The user has an orange cat named Doudou who is afraid of thunder.',
        'mem.tags': 'Tags (comma separated)',
        'mem.importance': 'Importance',
        'mem.search': 'Search memories',
        'mem.empty': 'No memories yet. Things worth keeping will be recorded as you talk.',
        'mem.noneMatch': 'No matching memories.',
        'mem.review': 'Review',
        'mem.reviewDue': 'Review due',
        'mem.pin': 'Pin',
        'mem.unpin': 'Unpin',
        'mem.forget': 'Forget',
        'mem.restore': 'Restore',
        'mem.archived': 'Forgotten memories',
        'mem.archivedHint': 'Memories that fade below the threshold move here and can be restored.',
        'mem.retention': 'Clarity',
        'mem.importanceValue': 'Importance',
        'mem.cardHint': 'Memories belong to the character: these are {name}\'s memories, and switching characters switches them.',
        'mem.clear': 'Clear this card\'s memories',
        'mem.clearConfirm': 'Clear every memory of this character, including forgotten ones? This cannot be undone.',
        'mem.ioNote': 'Import/export covers only the current character\'s memories.',
        'diary.enabled': 'Diary',
        'diary.enabledHint': 'Let the model write a short diary entry at natural end points.',
        'diary.auto': 'Auto digest',
        'diary.autoHint': 'After each turn, record your points as one diary entry per day (local, no model call).',
        'diary.empty': 'The diary is empty.',
        'diary.write': 'Write one',
        'diary.titlePlaceholder': 'Title',
        'diary.bodyPlaceholder': 'What happened today?',
        'diary.source.model': 'Model',
        'diary.source.local': 'Auto digest',
        'diary.source.manual': 'Manual',
        'diary.deleteConfirm': 'Delete this diary entry?',
        'diary.cardHint': 'Diaries belong to the character too: these are {name}\'s diaries, and switching characters switches them.',
        'diary.ioNote': 'Import/export covers only the current character\'s diaries.',
        'lib.add': 'Add an entry',
        'lib.edit': 'Edit entry',
        'lib.title': 'Title',
        'lib.titlePlaceholder': 'e.g. the meme "I can\'t even" / a knowledge note',
        'lib.kind': 'Kind',
        'lib.kind.meme': 'Meme',
        'lib.kind.knowledge': 'Knowledge',
        'lib.kind.reference': 'Reference',
        'lib.kind.note': 'Note',
        'lib.content': 'Content',
        'lib.contentPlaceholder': 'How the meme is used, an explanation, or what you found on the web…',
        'lib.tags': 'Tags (comma separated)',
        'lib.url': 'Source URL',
        'lib.urlPlaceholder': 'https://…',
        'lib.search': 'Search library',
        'lib.empty': 'The library is empty. Save memes, knowledge, or web references here as you chat.',
        'lib.noneMatch': 'No matching entries.',
        'lib.save': 'Save changes',
        'lib.addBtn': 'Save to library',
        'lib.needContent': 'A title or some content is required.',
        'lib.editBtn': 'Edit',
        'lib.deleteConfirm': 'Delete this entry?',
        'lib.clear': 'Clear this card\'s library',
        'lib.clearConfirm': 'Clear every entry in this character\'s library? This cannot be undone.',
        'lib.cardHint': 'The library belongs to the character: these are {name}\'s entries, and switching characters switches them.',
        'lib.ioNote': 'Import/export covers only the current character\'s library.',
        'lib.source.manual': 'Manual',
        'lib.source.model': 'Model',
        'lib.source.web': 'Web',
        'lib.source.import': 'Imported',
        'lib.updated': 'Updated {time}',
        'notice.libSaved': 'Entry saved.',
        'notice.libUpdated': 'Entry updated.',
        'notice.libDeleted': 'Entry deleted.',
        'notice.libCleared': 'This character\'s library is now empty.',
        'update.title': 'Version & updates',
        'update.hint': 'Compares the local version with package.json on GitHub main; it only checks, never installs.',
        'update.current': 'Current version v{version}',
        'update.check': 'Check for updates',
        'update.checking': 'Checking…',
        'update.idle': 'Check GitHub for a newer version.',
        'update.available': 'New version available: v{version}',
        'update.upToDate': 'Up to date',
        'update.failed': 'Check failed',
        'update.repo': 'Open repository',
        'update.howto': 'To update: reinstall this GitHub repository from the Plugins page, or git pull the local folder and reload/restart DSH.',
        'opt.topK': 'Memories injected per step',
        'opt.title': 'Options',
        'opt.topKHint': 'Fewer saves tokens; more makes old memories easier to recall.',
        'opt.threshold': 'Forget threshold (%)',
        'opt.thresholdHint': 'Memories below this clarity move to Forgotten and leave the prompt.',
        'opt.max': 'Memory cap',
        'opt.maxHint': 'When full, clear and important memories are kept first.',
        'opt.storage': 'Data file',
        'opt.curve': 'Memories decay on an Ebbinghaus curve: slow at first, then faster without review. Every review or natural recall extends their lifetime; important ones can be pinned.',
        'btn.save': 'Save',
        'btn.add': 'Add',
        'btn.delete': 'Delete',
        'btn.cancel': 'Cancel',
        'btn.close': 'Close',
        'btn.refresh': 'Refresh',
        'btn.saving': 'Saving…',
        'notice.modeOn': 'Persona mode is on.',
        'notice.modeOff': 'Persona mode is off.',
        'notice.cardSaved': 'Character card saved.',
        'notice.cardDeleted': 'Character card deleted.',
        'notice.memSaved': 'Remembered.',
        'notice.reviewed': 'Memory reinforced.',
        'notice.diarySaved': 'Diary saved.',
        'notice.deleted': 'Deleted.',
        'notice.settingsSaved': 'Settings saved.',
        'notice.cleared': 'Persona turned off in every chat.',
        'notice.memCleared': 'Cleared this character\'s memories.',
        'notice.failed': 'Operation failed',
        'chip.on': 'Persona · {name}',
        'chip.off': 'Persona off in this chat',
        'menu.current': 'Current: {name}',
        'menu.currentOff': 'Persona is off in this chat',
        'menu.turnOff': 'Turn persona off in this chat',
        'menu.turnOn': 'Turn persona on in this chat',
        'menu.switchCard': 'Switch character (memories follow)',
        'chip.stateOn': 'on',
        'chip.stateOff': 'off',
        'chip.tip': 'Left click toggles this chat; right click picks a character',
        'chip.offScope': 'Persona off in this chat',
        'menu.globalOn': 'Turn global persona on',
        'menu.globalOff': 'Turn global persona off',
        'scope.title': 'Scope',
        'scope.desc': 'When the master switch is on, only conversations inside this scope receive the persona and memories.',
        'scope.mode.all': 'All chats',
        'scope.mode.workspaces': 'Selected workspaces',
        'scope.mode.sessions': 'Selected chats',
        'scope.workspaces': 'Workspaces',
        'scope.sessions': 'Open chats',
        'scope.workspacesEmpty': 'No workspaces registered yet. Open or create one from the sidebar first.',
        'scope.sessionsEmpty': 'No chats are open right now.',
        'scope.workspacesHint': 'Every chat in a selected workspace is enabled, including future ones.',
        'scope.sessionsHint': 'Only checked chats are enabled; the choice survives closing the chat.',
        'scope.masterOff': 'The master persona switch is off, so scope settings have no effect yet.',
        'scope.overrideOn': 'Forced on',
        'scope.overrideOff': 'Forced off',
        'scope.overrideInherit': 'Follows scope',
        'scope.follow': 'Follow scope settings',
        'scope.on': 'Enable in this chat',
        'scope.off': 'Disable in this chat',
        'scope.clearOverride': 'Clear override',
        'scope.precedence': 'Priority: per-chat override > scope mode; the master switch turns everything off.',
        'notice.scopeSaved': 'Scope updated.',
        'io.export': 'Export',
        'io.cards': 'Character cards',
        'switch.on': 'On',
        'switch.off': 'Off',
        'io.import': 'Import',
        'io.exportAll': 'Export full backup',
        'io.importAll': 'Import full backup',
        'io.exported': 'Exported.',
        'io.invalid': 'That file is not valid JSON.',
        'io.tooLarge': 'File is too large (8MB max).',
        'io.merge': 'Merge',
        'io.replace': 'Replace',
        'io.merged': 'Merged.',
        'io.replaced': 'Replaced.',
        'io.done': 'Import complete.',
        'io.failed': 'Export failed.',
        'io.hint': 'Exports a JSON file; importing can merge or replace.',
        'io.scopeNote': 'A full backup does not enable chats outside your current scope.',
        'age.today': 'today',
        'age.yesterday': 'yesterday',
        'age.days': '{count} days ago',
        'retention.clear': 'clear',
        'retention.recalled': 'recalled',
        'retention.fuzzy': 'fuzzy',
        'retention.fading': 'fading',
        loading: 'Loading…',
        'badge.pinned': 'pinned',
        'badge.due': 'due',
        'unit.days': 'days',
        'unit.percent': '%'
      }
    }

    /* ---------------------------------------------------------------- */
    /* Shared state                                                      */
    /* ---------------------------------------------------------------- */

    function createPersonaStore() {
      let snapshot = { state: null, error: '', loading: false }
      const listeners = new Set()
      let started = false

      const publish = (patch) => {
        snapshot = { ...snapshot, ...patch }
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch {
            /* one bad subscriber must not break the others */
          }
        }
      }

      const request = async (path, body) => {
        const init =
          body === undefined
            ? { method: 'GET', cache: 'no-store', headers: { 'x-dsh-persona-memory': '1' } }
            : {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-dsh-persona-memory': '1' },
                body: JSON.stringify(body),
              }
        const response = await fetch(API + path, init)
        let data = null
        try {
          data = await response.json()
        } catch {
          data = null
        }
        if (!response.ok || !data || data.ok === false) {
          throw new Error((data && data.error) || `HTTP ${response.status}`)
        }
        return data
      }

      const refresh = async () => {
        publish({ loading: true })
        try {
          const data = await request('/state')
          publish({ state: data, error: '', loading: false })
        } catch (error) {
          publish({ error: error && error.message ? error.message : String(error), loading: false })
        }
      }

      const mutate = async (path, body) => {
        try {
          const data = await request(path, body)
          publish({ state: data.state || snapshot.state, error: '' })
          return data
        } catch (error) {
          publish({ error: error && error.message ? error.message : String(error) })
          throw error
        }
      }

      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          if (!started) {
            started = true
            refresh()
          }
          return () => listeners.delete(listener)
        },
        refresh,
        mutate,
      }
    }

    const store = createPersonaStore()

    function usePersona() {
      const [snap, setSnap] = useState(store.getSnapshot())
      useEffect(() => {
        setSnap(store.getSnapshot())
        return store.subscribe(() => setSnap(store.getSnapshot()))
      }, [])
      return snap
    }

    /* ---------------------------------------------------------------- */
    /* Helpers                                                           */
    /* ---------------------------------------------------------------- */

    function pad(value) {
      return String(value).padStart(2, '0')
    }

    function formatDateTime(timestamp) {
      const date = new Date(timestamp)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function ageText(t, days) {
      if (days <= 0) return t('age.today')
      if (days === 1) return t('age.yesterday')
      return t('age.days', { count: days })
    }

    function retentionLabel(t, value) {
      if (value >= 0.8) return t('retention.clear')
      if (value >= 0.5) return t('retention.recalled')
      if (value >= 0.25) return t('retention.fuzzy')
      return t('retention.fading')
    }

    function tone(value) {
      if (value < 0.2) return ' is-low'
      if (value < 0.45) return ' is-mid'
      return ''
    }

    function stars(importance) {
      const filled = Math.max(0, Math.min(5, importance))
      return '★'.repeat(filled) + '☆'.repeat(5 - filled)
    }

    function newSectionId() {
      try {
        return crypto.randomUUID()
      } catch {
        return 'sec-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      }
    }

    function splitRules(text) {
      return String(text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12)
    }

    function samePath(left, right) {
      const norm = (value) =>
        String(value || '')
          .replace(/\//g, '\\')
          .replace(/\\+$/, '')
          .toLowerCase()
      return norm(left) === norm(right)
    }

    function downloadText(filename, text) {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    }

    function fileStamp() {
      const now = new Date()
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
    }

    function Btn(props) {
      const { children, variant, className, ...rest } = props
      return h(
        'button',
        {
          type: 'button',
          className: 'dspm-btn' + (variant ? ' dspm-btn-' + variant : '') + (className ? ' ' + className : ''),
          ...rest,
        },
        children,
      )
    }

    /** Circled question mark; the explanation appears on hover/focus. */
    function InfoHint(props) {
      return h(
        'span',
        {
          className: 'dspm-info' + (props.align === 'right' ? ' is-right' : ''),
          role: 'img',
          tabIndex: 0,
          'aria-label': props.text,
          'data-tip': props.text,
        },
        '?',
      )
    }

    function Field(props) {
      return h(
        'label',
        { className: 'dspm-field' },
        h(
          'span',
          { className: 'dspm-field-label' },
          props.label,
          props.hint ? h(InfoHint, { text: props.hint }) : null,
        ),
        props.children,
      )
    }

    function Switch(props) {
      const onLabel = props.onLabel || '开'
      const offLabel = props.offLabel || '关'
      return h(
        'span',
        { className: 'dspm-switch-field' },
        h(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': props.checked ? 'true' : 'false',
            'aria-label': props.label,
            title: props.checked ? onLabel : offLabel,
            className: 'dspm-switch' + (props.checked ? ' is-on' : ''),
            disabled: props.disabled,
            onClick: () => props.onChange && props.onChange(!props.checked),
          },
          h('span', { className: 'dspm-switch-thumb' }),
        ),
        h(
          'span',
          { className: 'dspm-switch-state' + (props.checked ? ' is-on' : '') },
          props.checked ? onLabel : offLabel,
        ),
      )
    }

    /** A textarea that follows its content up to `maxHeight`, then scrolls. */
    function AutoTextarea(props) {
      const { maxHeight = 320, minHeight = 72, style, ...rest } = props
      const ref = useRef(null)

      const resize = () => {
        const element = ref.current
        if (!element) return
        element.style.height = 'auto'
        const border = Math.max(0, element.offsetHeight - element.clientHeight)
        const content = element.scrollHeight + border
        const next = Math.min(maxHeight, Math.max(minHeight, content))
        element.style.height = next + 'px'
        element.style.overflowY = content > maxHeight ? 'auto' : 'hidden'
      }

      useEffect(() => {
        resize()
      }, [rest.value, maxHeight, minHeight])

      useEffect(() => {
        const onWindowResize = () => resize()
        window.addEventListener('resize', onWindowResize)
        return () => window.removeEventListener('resize', onWindowResize)
      }, [])

      return h('textarea', {
        ...rest,
        ref,
        style: {
          ...style,
          minHeight: minHeight + 'px',
          maxHeight: maxHeight + 'px',
          overflowY: 'hidden',
          resize: 'none',
        },
        onInput: (event) => {
          resize()
          if (rest.onInput) rest.onInput(event)
        },
      })
    }

    function Stat(props) {
      return h(
        'div',
        { className: 'dspm-stat' },
        h('span', { className: 'dspm-stat-value' }, props.value),
        h('span', { className: 'dspm-stat-label' }, props.label),
      )
    }

    function Notice(props) {
      if (!props.notice) return null
      return h(
        'div',
        { className: 'dspm-notice' + (props.notice.ok ? ' is-ok' : ' is-error') },
        props.notice.text,
      )
    }

    function Empty(props) {
      return h('div', { className: 'dspm-empty' }, props.children)
    }

    /* ---------------------------------------------------------------- */
    /* Import / export controls                                          */
    /* ---------------------------------------------------------------- */

    function DataIO(props) {
      const { t, kind, run, busy } = props
      const [pending, setPending] = useState(null)
      const [note, setNote] = useState('')
      const fileRef = useRef(null)

      const exportNow = async () => {
        setNote('')
        try {
          const response = await fetch(`${API}/export?kind=${encodeURIComponent(kind)}`, {
            cache: 'no-store',
            headers: { 'x-dsh-persona-memory': '1' },
          })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const data = await response.json()
          downloadText(`persona-memory-${kind}-${fileStamp()}.json`, JSON.stringify(data, null, 2))
          setNote(t('io.exported'))
        } catch (error) {
          setNote((error && error.message) || t('io.failed'))
        }
      }

      const onFile = (event) => {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!file) return
        if (file.size > 8 * 1024 * 1024) {
          setNote(t('io.tooLarge'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result))
            setPending({ name: file.name, payload })
            setNote('')
          } catch {
            setNote(t('io.invalid'))
          }
        }
        reader.onerror = () => setNote(t('io.invalid'))
        reader.readAsText(file)
      }

      const apply = (mode) => {
        if (!pending) return
        run(async () => {
          await store.mutate('/import', { kind, mode, payload: pending.payload })
          setPending(null)
          setNote(mode === 'replace' ? t('io.replaced') : t('io.merged'))
        }, t('io.done'))
      }

      return h(
        'div',
        { className: 'dspm-io' },
        h(
          Btn,
          { onClick: exportNow, disabled: busy },
          kind === 'all' ? t('io.exportAll') : t('io.export'),
        ),
        h(
          Btn,
          { onClick: () => fileRef.current && fileRef.current.click(), disabled: busy },
          kind === 'all' ? t('io.importAll') : t('io.import'),
        ),
        h('input', {
          ref: fileRef,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: onFile,
        }),
        pending
          ? h(
              'div',
              { className: 'dspm-io-pending' },
              h('span', { className: 'dspm-io-name', title: pending.name }, pending.name),
              h(Btn, { onClick: () => apply('merge'), disabled: busy }, t('io.merge')),
              h(
                Btn,
                { variant: 'danger', onClick: () => apply('replace'), disabled: busy },
                t('io.replace'),
              ),
              h(Btn, { onClick: () => setPending(null), disabled: busy }, t('btn.cancel')),
            )
          : null,
        note ? h('span', { className: 'dspm-io-note' }, note) : null,
      )
    }

    /* ---------------------------------------------------------------- */
    /* Settings page                                                     */
    /* ---------------------------------------------------------------- */

    function SettingsPage(props) {
      const t = props.t
      const snap = usePersona()
      const state = snap.state
      const [tab, setTab] = useState('persona')
      const [notice, setNotice] = useState(null)
      const [busy, setBusy] = useState(false)
      const [draft, setDraft] = useState(null)

      const activeId = state && state.activeCardId
      const activeStamp = state && state.activeCard ? state.activeCard.updatedAt : 0
      useEffect(() => {
        if (!state || !state.activeCard) return
        setDraft({
          ...state.activeCard,
          sections: (state.activeCard.sections || []).map((section) => ({ ...section })),
          traits: { ...(state.activeCard.traits || {}) },
        })
      }, [activeId, activeStamp])

      const run = useCallback(
        async (operation, successText) => {
          setBusy(true)
          setNotice(null)
          try {
            await operation()
            if (successText) setNotice({ ok: true, text: successText })
          } catch (error) {
            setNotice({ ok: false, text: (error && error.message) || t('notice.failed') })
          } finally {
            setBusy(false)
          }
        },
        [t],
      )

      if (!state) {
        return h(
          'div',
          { className: 'dspm-page' },
          h(Notice, { notice: snap.error ? { ok: false, text: snap.error } : null }),
          h(Empty, null, snap.loading ? t('loading') : t('notice.failed')),
          h(Btn, { onClick: () => store.refresh() }, t('btn.refresh')),
        )
      }

      const personaCount = Array.isArray(state.settings.personaSessions) ? state.settings.personaSessions.length : 0
      const tabs = [
        ['persona', 'tab.persona'],
        ['memory', 'tab.memory'],
        ['library', 'tab.library'],
        ['diary', 'tab.diary'],
        ['options', 'tab.options'],
      ]

      return h(
        'div',
        { className: 'dspm-page' },
        h(
          'header',
          { className: 'dspm-hero' },
          h(
            'div',
            { className: 'dspm-hero-text' },
            h('h2', { className: 'dspm-title' }, t('title')),
            h('p', { className: 'dspm-desc' }, t('desc')),
          ),
          h(
            'div',
            { className: 'dspm-mode' },
            h(
              'div',
              { className: 'dspm-mode-text' },
              h(
                'span',
                { className: 'dspm-mode-state' + (personaCount > 0 ? ' is-on' : '') },
                t('mode.perChat'),
              ),
              h(
                'span',
                { className: 'dspm-mode-hint' },
                t('mode.perChatCount', { count: personaCount }),
                h(InfoHint, { text: t('mode.perChatHint') }),
              ),
            ),
            h(
              Btn,
              {
                variant: 'danger',
                disabled: busy || personaCount === 0,
                onClick: () => run(() => store.mutate('/persona-clear', {}), t('notice.cleared')),
              },
              t('mode.clearAll'),
            ),
          ),
        ),
        h(Notice, { notice }),
        snap.error ? h(Notice, { notice: { ok: false, text: snap.error } }) : null,
        h(
          'nav',
          { className: 'dspm-tabs', role: 'tablist' },
          tabs.map(([id, key]) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === id ? 'true' : 'false',
                className: 'dspm-tab' + (tab === id ? ' is-active' : ''),
                onClick: () => setTab(id),
              },
              t(key),
            ),
          ),
        ),
        tab === 'persona'
          ? h(PersonaTab, { t, state, draft, setDraft, run, busy })
          : null,
        tab === 'memory'
          ? h(MemoryTab, { t, state, run, busy })
          : null,
        tab === 'library'
          ? h(LibraryTab, { t, state, run, busy })
          : null,
        tab === 'diary'
          ? h(DiaryTab, { t, state, run, busy })
          : null,
        tab === 'options'
          ? h(OptionsTab, { t, state, run, busy })
          : null,
        h('p', { className: 'dspm-foot' }, t('opt.storage') + '：' + state.dataFile),
      )
    }

    function PersonaTab(props) {
      const { t, state, draft, setDraft, run, busy } = props
      if (!draft) return null
      const sections = Array.isArray(draft.sections) ? draft.sections : []
      const traits = draft.traits || {}
      const update = (key, value) => setDraft({ ...draft, [key]: value })
      const updateTrait = (key, value) =>
        setDraft({ ...draft, traits: { ...traits, [key]: Number(value) } })
      const updateSection = (index, patch) =>
        setDraft({
          ...draft,
          sections: sections.map((section, position) =>
            position === index ? { ...section, ...patch } : section,
          ),
        })
      const addSection = () =>
        setDraft({
          ...draft,
          sections: [...sections, { id: newSectionId(), label: '', content: '' }],
        })
      const removeSection = (index) =>
        setDraft({ ...draft, sections: sections.filter((_, position) => position !== index) })
      const moveSection = (index, delta) => {
        const target = index + delta
        if (target < 0 || target >= sections.length) return
        const next = [...sections]
        ;[next[index], next[target]] = [next[target], next[index]]
        setDraft({ ...draft, sections: next })
      }

      const cardPayload = () => ({
        id: draft.id,
        name: draft.name,
        title: draft.title,
        greeting: draft.greeting,
        sections,
        traits,
      })

      const save = () =>
        run(
          () => store.mutate('/card', { action: 'save', card: cardPayload() }),
          t('notice.cardSaved'),
        )

      const create = () =>
        run(async () => {
          const data = await store.mutate('/card', {
            action: 'create',
            card: { name: t('card.defaultName') },
          })
          await store.mutate('/card', { action: 'activate', id: data.card.id })
        }, t('notice.cardSaved'))

      const remove = () => {
        if (!window.confirm(t('card.deleteConfirm'))) return
        run(() => store.mutate('/card', { action: 'delete', id: draft.id }), t('notice.cardDeleted'))
      }

      const traitRows = [
        ['humanize', 'trait.humanize'],
        ['memes', 'trait.memes'],
        ['emotion', 'trait.emotion'],
        ['actions', 'trait.actions'],
        ['initiative', 'trait.initiative'],
        ['teasing', 'trait.teasing'],
      ]

      return h(
        'div',
        { className: 'dspm-card' },
        h(
          'div',
          { className: 'dspm-card-head' },
          h(
            'div',
            { className: 'dspm-card-select' },
            h('span', { className: 'dspm-field-label' }, t('card.active')),
            h(
              'select',
              {
                className: 'dspm-select',
                value: state.activeCardId,
                disabled: busy,
                onChange: (event) =>
                  run(() => store.mutate('/card', { action: 'activate', id: event.target.value })),
              },
              state.cards.map((card) =>
                h('option', { key: card.id, value: card.id }, card.name + (card.title ? ' · ' + card.title : '')),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dspm-card-actions' },
            h(Btn, { onClick: create, disabled: busy }, t('card.new')),
            h(Btn, { variant: 'danger', onClick: remove, disabled: busy || state.cards.length <= 1 }, t('card.delete')),
          ),
        ),
        h(
          'div',
          { className: 'dspm-toolbar' },
          h(
            'span',
            { className: 'dspm-toolbar-label' },
            t('io.cards'),
            h(InfoHint, { text: t('io.hint') }),
          ),
          h(DataIO, { t, kind: 'cards', run, busy }),
        ),
        h(
          'div',
          { className: 'dspm-grid-2' },
          h(Field, { label: t('card.name') }, h('input', {
            className: 'dspm-input',
            value: draft.name,
            maxLength: 40,
            onChange: (event) => update('name', event.target.value),
          })),
          h(Field, { label: t('card.title') }, h('input', {
            className: 'dspm-input',
            value: draft.title,
            maxLength: 60,
            onChange: (event) => update('title', event.target.value),
          })),
        ),
        h(Field, { label: t('card.greeting') }, h('input', {
          className: 'dspm-input',
          value: draft.greeting,
          maxLength: 500,
          onChange: (event) => update('greeting', event.target.value),
        })),
        h(
          'div',
          { className: 'dspm-subhead' },
          h('span', null, t('card.traits')),
          h(InfoHint, { text: t('card.traitsHint') }),
        ),
        h(
          'div',
          { className: 'dspm-grid-2' },
          traitRows.map(([key, labelKey]) =>
            h(
              'div',
              { className: 'dspm-trait', key },
              h(
                'div',
                { className: 'dspm-trait-head' },
                h('span', { className: 'dspm-field-label' }, t(labelKey)),
                h('span', { className: 'dspm-trait-value' }, traits[key] ?? 50),
              ),
              h('input', {
                className: 'dspm-range',
                type: 'range',
                min: 0,
                max: 100,
                step: 5,
                value: traits[key] ?? 50,
                onChange: (event) => updateTrait(key, event.target.value),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dspm-subhead' },
          h(
            'span',
            { className: 'dspm-subhead-text' },
            t('card.sections'),
            h(InfoHint, { text: t('card.sectionsHint') }),
          ),
          h(Btn, { onClick: addSection, disabled: busy }, t('card.addSection')),
        ),
        sections.length
          ? sections.map((section, index) =>
              h(
                'div',
                { className: 'dspm-section', key: section.id },
                h(
                  'div',
                  { className: 'dspm-section-head' },
                  h('input', {
                    className: 'dspm-input dspm-section-label',
                    value: section.label,
                    maxLength: 60,
                    placeholder: t('card.sectionPlaceholder'),
                    onChange: (event) => updateSection(index, { label: event.target.value }),
                  }),
                  h(
                    'div',
                    { className: 'dspm-actions' },
                    h(
                      Btn,
                      {
                        onClick: () => moveSection(index, -1),
                        disabled: index === 0,
                        title: t('card.up'),
                      },
                      '↑',
                    ),
                    h(
                      Btn,
                      {
                        onClick: () => moveSection(index, 1),
                        disabled: index === sections.length - 1,
                        title: t('card.down'),
                      },
                      '↓',
                    ),
                    h(
                      Btn,
                      { variant: 'danger', onClick: () => removeSection(index), disabled: busy },
                      t('btn.delete'),
                    ),
                  ),
                ),
                h(AutoTextarea, {
                  className: 'dspm-textarea',
                  rows: 3,
                  maxHeight: 300,
                  placeholder: t('card.contentPlaceholder'),
                  value: section.content,
                  onChange: (event) => updateSection(index, { content: event.target.value }),
                }),
              ),
            )
          : h(Empty, null, t('card.sectionsEmpty')),
        h(
          'div',
          { className: 'dspm-actions' },
          h(Btn, { variant: 'primary', onClick: save, disabled: busy }, busy ? t('btn.saving') : t('btn.save')),
        ),
      )
    }

    function MemoryTab(props) {
      const { t, state, run, busy } = props
      const [text, setText] = useState('')
      const [tags, setTags] = useState('')
      const [importance, setImportance] = useState(3)
      const [query, setQuery] = useState('')
      const [showArchived, setShowArchived] = useState(false)

      const add = () =>
        run(async () => {
          if (!text.trim()) throw new Error(t('mem.placeholder'))
          await store.mutate('/memory', {
            action: 'add',
            text,
            tags,
            importance: Number(importance),
          })
          setText('')
          setTags('')
          setImportance(3)
        }, t('notice.memSaved'))

      const needle = query.trim().toLowerCase()
      const matches = (memory) =>
        !needle ||
        memory.text.toLowerCase().includes(needle) ||
        memory.tags.some((tag) => tag.toLowerCase().includes(needle))
      const memories = state.memories.filter(matches)
      const cardName = (state.activeCard && state.activeCard.name) || ''

      const clearMemories = () => {
        if (!window.confirm(t('mem.clearConfirm'))) return
        run(() => store.mutate('/memory', { action: 'clear' }), t('notice.memCleared'))
      }

      return h(
        'div',
        { className: 'dspm-stack' },
        h(
          'div',
          { className: 'dspm-stats' },
          h(Stat, { label: t('mem.total'), value: state.stats.active }),
          h(Stat, { label: t('mem.due'), value: state.stats.due }),
          h(Stat, { label: t('mem.avg'), value: Math.round(state.stats.avgRetention * 100) + '%' }),
          h(Stat, { label: t('mem.forgotten'), value: state.stats.forgotten }),
        ),
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-card-title' },
            t('mem.add'),
            h(InfoHint, { text: t('mem.cardHint', { name: cardName }) }),
          ),
          h(AutoTextarea, {
            className: 'dspm-textarea',
            rows: 3,
            maxHeight: 260,
            placeholder: t('mem.placeholder'),
            value: text,
            onChange: (event) => setText(event.target.value),
          }),
          h(
            'div',
            { className: 'dspm-grid-2' },
            h(Field, { label: t('mem.tags') }, h('input', {
              className: 'dspm-input',
              value: tags,
              placeholder: '猫, 日常',
              onChange: (event) => setTags(event.target.value),
            })),
            h(
              'label',
              { className: 'dspm-field' },
              h('span', { className: 'dspm-field-label' }, t('mem.importance')),
              h(
                'select',
                {
                  className: 'dspm-select',
                  value: importance,
                  onChange: (event) => setImportance(Number(event.target.value)),
                },
                [1, 2, 3, 4, 5].map((value) =>
                  h('option', { key: value, value }, stars(value) + ' ' + value),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dspm-actions' },
            h(Btn, { variant: 'primary', onClick: add, disabled: busy }, t('btn.add')),
            h(
              Btn,
              {
                onClick: () => run(() => store.mutate('/memory', { action: 'review' }), t('notice.reviewed')),
                disabled: busy || state.stats.due === 0,
              },
              t('mem.reviewDue') + (state.stats.due ? ' (' + state.stats.due + ')' : ''),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dspm-toolbar' },
          h('input', {
            className: 'dspm-input dspm-search',
            placeholder: t('mem.search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'div',
            { className: 'dspm-actions' },
            h(InfoHint, { text: t('mem.ioNote'), align: 'right' }),
            h(DataIO, { t, kind: 'memories', run, busy }),
            h(
              Btn,
              {
                variant: 'danger',
                onClick: clearMemories,
                disabled: busy || (state.stats.active === 0 && state.stats.forgotten === 0),
              },
              t('mem.clear'),
            ),
          ),
        ),
        memories.length
          ? h('div', { className: 'dspm-list' }, memories.map((memory) => h(MemoryItem, { key: memory.id, t, memory, run, busy })))
          : h(Empty, null, needle ? t('mem.noneMatch') : t('mem.empty')),
        state.archived.length
          ? h(
              'div',
              { className: 'dspm-archived' },
              h(
                'span',
                { className: 'dspm-archived-head' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dspm-link',
                    onClick: () => setShowArchived(!showArchived),
                  },
                  t('mem.archived') + ' (' + state.stats.forgotten + ')',
                ),
                h(InfoHint, { text: t('mem.archivedHint') }),
              ),
              showArchived
                ? h(
                    'div',
                    { className: 'dspm-stack' },
                    state.archived.map((memory) =>
                      h(
                        'div',
                        { className: 'dspm-mem is-archived', key: memory.id },
                        h('div', { className: 'dspm-mem-text' }, memory.text),
                        h(
                          'div',
                          { className: 'dspm-mem-actions' },
                          h(
                            Btn,
                            {
                              onClick: () =>
                                run(
                                  () => store.mutate('/memory', { action: 'restore', id: memory.id }),
                                  t('notice.reviewed'),
                                ),
                              disabled: busy,
                            },
                            t('mem.restore'),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,
            )
          : null,
      )
    }

    function MemoryItem(props) {
      const { t, memory, run, busy } = props
      const percent = Math.round(memory.retention * 100)
      return h(
        'div',
        { className: 'dspm-mem' },
        h(
          'div',
          { className: 'dspm-mem-head' },
          h('div', { className: 'dspm-mem-text' }, memory.text),
          h(
            'div',
            { className: 'dspm-badges' },
            memory.pinned ? h('span', { className: 'dspm-badge is-pinned' }, t('badge.pinned')) : null,
            memory.due ? h('span', { className: 'dspm-badge is-due' }, t('badge.due')) : null,
          ),
        ),
        h(
          'div',
          { className: 'dspm-mem-meta' },
          h('span', null, ageText(t, memory.ageDays)),
          h('span', null, percent + '% · ' + retentionLabel(t, memory.retention)),
          h('span', { className: 'dspm-stars', title: t('mem.importance') }, stars(memory.importance)),
          memory.tags.map((tag) => h('span', { key: tag, className: 'dspm-tag' }, '#' + tag)),
        ),
        h(
          'div',
          { className: 'dspm-meter' },
          h('div', {
            className: 'dspm-meter-fill' + tone(memory.retention),
            style: { width: Math.max(2, percent) + '%' },
          }),
        ),
        h(
          'div',
          { className: 'dspm-mem-actions' },
          h(
            Btn,
            {
              onClick: () => run(() => store.mutate('/memory', { action: 'review', ids: [memory.id] }), t('notice.reviewed')),
              disabled: busy,
            },
            t('mem.review'),
          ),
          h(
            Btn,
            {
              onClick: () =>
                run(
                  () =>
                    store.mutate('/memory', {
                      action: memory.pinned ? 'unpin' : 'pin',
                      id: memory.id,
                    }),
                  t('notice.reviewed'),
                ),
              disabled: busy,
            },
            memory.pinned ? t('mem.unpin') : t('mem.pin'),
          ),
          h(
            Btn,
            {
              variant: 'danger',
              onClick: () => run(() => store.mutate('/memory', { action: 'forget', id: memory.id }), t('notice.deleted')),
              disabled: busy,
            },
            t('mem.forget'),
          ),
        ),
      )
    }

    function LibraryItem(props) {
      const { t, entry, busy, onEdit, onDelete } = props
      const kindLabel = t('lib.kind.' + entry.kind)
      return h(
        'article',
        { className: 'dspm-lib' },
        h(
          'div',
          { className: 'dspm-lib-head' },
          h('span', { className: 'dspm-badge' }, kindLabel),
          h('div', { className: 'dspm-lib-title' }, entry.title),
          h(
            'div',
            { className: 'dspm-actions' },
            h(Btn, { onClick: () => onEdit(entry), disabled: busy }, t('lib.editBtn')),
            h(Btn, { variant: 'danger', onClick: () => onDelete(entry), disabled: busy }, t('btn.delete')),
          ),
        ),
        entry.content ? h('p', { className: 'dspm-lib-body' }, entry.content) : null,
        h(
          'div',
          { className: 'dspm-mem-meta' },
          entry.tags.map((tag) => h('span', { key: tag, className: 'dspm-tag' }, '#' + tag)),
          entry.url
            ? h(
                'a',
                {
                  className: 'dspm-lib-link',
                  href: entry.url,
                  target: '_blank',
                  rel: 'noreferrer',
                },
                entry.url,
              )
            : null,
          h('span', null, t('lib.source.' + (entry.source || 'manual'))),
          h('span', null, t('lib.updated', { time: formatDateTime(entry.updatedAt) })),
        ),
      )
    }

    function LibraryTab(props) {
      const { t, state, run, busy } = props
      const [editingId, setEditingId] = useState('')
      const [title, setTitle] = useState('')
      const [content, setContent] = useState('')
      const [kind, setKind] = useState('knowledge')
      const [tags, setTags] = useState('')
      const [url, setUrl] = useState('')
      const [query, setQuery] = useState('')
      const cardName = (state.activeCard && state.activeCard.name) || ''

      const resetForm = () => {
        setEditingId('')
        setTitle('')
        setContent('')
        setKind('knowledge')
        setTags('')
        setUrl('')
      }

      useEffect(() => {
        resetForm()
        setQuery('')
      }, [state.activeCardId])

      const entries = Array.isArray(state.library) ? state.library : []
      const needle = query.trim().toLowerCase()
      const filtered = entries.filter((entry) => {
        if (!needle) return true
        return `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase().includes(needle)
      })

      const submit = () =>
        run(async () => {
          if (!title.trim() && !content.trim()) throw new Error(t('lib.needContent'))
          const payload = { title, content, kind, tags, url }
          if (editingId) {
            await store.mutate('/library', { action: 'update', id: editingId, ...payload })
          } else {
            await store.mutate('/library', { action: 'add', ...payload })
          }
          resetForm()
        }, editingId ? t('notice.libUpdated') : t('notice.libSaved'))

      const editEntry = (entry) => {
        setEditingId(entry.id)
        setTitle(entry.title)
        setContent(entry.content)
        setKind(entry.kind)
        setTags(entry.tags.join(', '))
        setUrl(entry.url || '')
      }

      const removeEntry = (entry) => {
        if (!window.confirm(t('lib.deleteConfirm'))) return
        run(() => store.mutate('/library', { action: 'delete', id: entry.id }), t('notice.libDeleted'))
      }

      const clearAll = () => {
        if (!window.confirm(t('lib.clearConfirm'))) return
        run(() => store.mutate('/library', { action: 'clear' }), t('notice.libCleared'))
      }

      return h(
        'div',
        { className: 'dspm-stack' },
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-card-title' },
            editingId ? t('lib.edit') : t('lib.add'),
            h('span', { className: 'dspm-badge' }, entries.length),
            h(InfoHint, { text: t('lib.cardHint', { name: cardName }) }),
          ),
          h(
            'div',
            { className: 'dspm-grid-2' },
            h(
              Field,
              { label: t('lib.title') },
              h('input', {
                className: 'dspm-input',
                placeholder: t('lib.titlePlaceholder'),
                value: title,
                maxLength: 160,
                onChange: (event) => setTitle(event.target.value),
              }),
            ),
            h(
              Field,
              { label: t('lib.kind') },
              h(
                'select',
                {
                  className: 'dspm-select',
                  value: kind,
                  onChange: (event) => setKind(event.target.value),
                },
                ['meme', 'knowledge', 'reference', 'note'].map((value) =>
                  h('option', { key: value, value }, t('lib.kind.' + value)),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dspm-grid-2' },
            h(
              Field,
              { label: t('lib.tags') },
              h('input', {
                className: 'dspm-input',
                value: tags,
                placeholder: '梗, 网络',
                onChange: (event) => setTags(event.target.value),
              }),
            ),
            h(
              Field,
              { label: t('lib.url') },
              h('input', {
                className: 'dspm-input',
                value: url,
                placeholder: t('lib.urlPlaceholder'),
                onChange: (event) => setUrl(event.target.value),
              }),
            ),
          ),
          h(
            Field,
            { label: t('lib.content') },
            h(AutoTextarea, {
              className: 'dspm-textarea',
              rows: 5,
              maxHeight: 320,
              placeholder: t('lib.contentPlaceholder'),
              value: content,
              onChange: (event) => setContent(event.target.value),
            }),
          ),
          h(
            'div',
            { className: 'dspm-actions' },
            h(
              Btn,
              { variant: 'primary', onClick: submit, disabled: busy },
              editingId ? t('lib.save') : t('lib.addBtn'),
            ),
            editingId ? h(Btn, { onClick: resetForm, disabled: busy }, t('btn.cancel')) : null,
          ),
        ),
        h(
          'div',
          { className: 'dspm-toolbar' },
          h('input', {
            className: 'dspm-input dspm-search',
            placeholder: t('lib.search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'div',
            { className: 'dspm-actions' },
            h(InfoHint, { text: t('lib.ioNote'), align: 'right' }),
            h(DataIO, { t, kind: 'library', run, busy }),
            h(
              Btn,
              { variant: 'danger', onClick: clearAll, disabled: busy || entries.length === 0 },
              t('lib.clear'),
            ),
          ),
        ),
        filtered.length
          ? h(
              'div',
              { className: 'dspm-list' },
              filtered.map((entry) =>
                h(LibraryItem, {
                  key: entry.id,
                  t,
                  entry,
                  busy,
                  onEdit: editEntry,
                  onDelete: removeEntry,
                }),
              ),
            )
          : h(Empty, null, needle ? t('lib.noneMatch') : t('lib.empty')),
      )
    }

    function DiaryTab(props) {
      const { t, state, run, busy } = props
      const [title, setTitle] = useState('')
      const [body, setBody] = useState('')
      const [open, setOpen] = useState(false)
      const cardName = (state.activeCard && state.activeCard.name) || ''

      const save = () =>
        run(async () => {
          if (!body.trim()) throw new Error(t('diary.bodyPlaceholder'))
          await store.mutate('/diary', { action: 'add', title, body })
          setTitle('')
          setBody('')
          setOpen(false)
        }, t('notice.diarySaved'))

      const sourceLabel = (source) => {
        if (source === 'local') return t('diary.source.local')
        if (source === 'manual') return t('diary.source.manual')
        return t('diary.source.model')
      }

      return h(
        'div',
        { className: 'dspm-stack' },
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-row' },
            h(
              'div',
              { className: 'dspm-row-title-line' },
              h('div', { className: 'dspm-row-title' }, t('diary.enabled')),
              h(InfoHint, { text: t('diary.enabledHint') }),
            ),
            h(Switch, {
              checked: state.settings.diaryEnabled,
              label: t('diary.enabled'),
              onLabel: t('switch.on'),
              offLabel: t('switch.off'),
              disabled: busy,
              onChange: (value) =>
                run(() => store.mutate('/settings', { settings: { diaryEnabled: value } }), t('notice.settingsSaved')),
            }),
          ),
          h(
            'div',
            { className: 'dspm-row' },
            h(
              'div',
              { className: 'dspm-row-title-line' },
              h('div', { className: 'dspm-row-title' }, t('diary.auto')),
              h(InfoHint, { text: t('diary.autoHint') }),
            ),
            h(Switch, {
              checked: state.settings.autoDigest,
              label: t('diary.auto'),
              onLabel: t('switch.on'),
              offLabel: t('switch.off'),
              disabled: busy,
              onChange: (value) =>
                run(() => store.mutate('/settings', { settings: { autoDigest: value } }), t('notice.settingsSaved')),
            }),
          ),
        ),
        h(
          'div',
          { className: 'dspm-toolbar' },
          h(
            'div',
            { className: 'dspm-card-title' },
            t('tab.diary'),
            h(InfoHint, { text: t('diary.cardHint', { name: cardName }) }),
          ),
          h(
            'div',
            { className: 'dspm-actions' },
            h(InfoHint, { text: t('diary.ioNote'), align: 'right' }),
            h(DataIO, { t, kind: 'diaries', run, busy }),
          ),
          h(Btn, { variant: 'primary', onClick: () => setOpen(!open) }, t('diary.write')),
        ),
        open
          ? h(
              'div',
              { className: 'dspm-card' },
              h('input', {
                className: 'dspm-input',
                placeholder: t('diary.titlePlaceholder'),
                value: title,
                onChange: (event) => setTitle(event.target.value),
              }),
              h(AutoTextarea, {
                className: 'dspm-textarea',
                rows: 4,
                maxHeight: 360,
                placeholder: t('diary.bodyPlaceholder'),
                value: body,
                onChange: (event) => setBody(event.target.value),
              }),
              h('div', { className: 'dspm-actions' }, h(Btn, { variant: 'primary', onClick: save, disabled: busy }, t('btn.save'))),
            )
          : null,
        state.diaries.length
          ? h(
              'div',
              { className: 'dspm-list' },
              state.diaries.map((entry) =>
                h(
                  'article',
                  { className: 'dspm-diary', key: entry.id },
                  h(
                    'div',
                    { className: 'dspm-diary-head' },
                    h('span', { className: 'dspm-diary-date' }, entry.date),
                    h('span', { className: 'dspm-diary-title' }, entry.title),
                    h('span', { className: 'dspm-badge' }, sourceLabel(entry.source)),
                    h(
                      Btn,
                      {
                        variant: 'danger',
                        className: 'dspm-diary-delete',
                        disabled: busy,
                        onClick: () => {
                          if (!window.confirm(t('diary.deleteConfirm'))) return
                          run(() => store.mutate('/diary', { action: 'delete', id: entry.id }), t('notice.deleted'))
                        },
                      },
                      t('btn.delete'),
                    ),
                  ),
                  h('p', { className: 'dspm-diary-body' }, entry.body),
                  entry.tags && entry.tags.length
                    ? h('div', { className: 'dspm-tags' }, entry.tags.map((tag) => h('span', { key: tag, className: 'dspm-tag' }, '#' + tag)))
                    : null,
                ),
              ),
            )
          : h(Empty, null, t('diary.empty')),
      )
    }

    function OptionsTab(props) {
      const { t, state, run, busy } = props
      const [topK, setTopK] = useState(state.settings.promptTopK)
      const [threshold, setThreshold] = useState(Math.round(state.settings.forgetThreshold * 100))
      const [max, setMax] = useState(state.settings.maxMemories)
      const [update, setUpdate] = useState({ status: 'idle', data: null, error: '' })

      useEffect(() => {
        setTopK(state.settings.promptTopK)
        setThreshold(Math.round(state.settings.forgetThreshold * 100))
        setMax(state.settings.maxMemories)
      }, [state.settings.promptTopK, state.settings.forgetThreshold, state.settings.maxMemories])

      const checkUpdate = async () => {
        setUpdate({ status: 'checking', data: null, error: '' })
        try {
          const response = await fetch(`${API}/update-check`, {
            cache: 'no-store',
            headers: { 'x-dsh-persona-memory': '1' },
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || !data || data.ok === false) {
            setUpdate({
              status: 'error',
              data: null,
              error: (data && data.error) || `HTTP ${response.status}`,
            })
          } else {
            setUpdate({ status: 'done', data, error: '' })
          }
        } catch (error) {
          setUpdate({
            status: 'error',
            data: null,
            error: (error && error.message) || String(error),
          })
        }
      }

      const updateStatus =
        update.status === 'checking'
          ? t('update.checking')
          : update.status === 'error'
            ? t('update.failed') + '：' + update.error
            : update.status === 'done'
              ? update.data.updateAvailable
                ? t('update.available', { version: update.data.latest })
                : t('update.upToDate')
              : t('update.idle')

      const save = () =>
        run(
          () =>
            store.mutate('/settings', {
              settings: {
                promptTopK: Number(topK),
                forgetThreshold: Number(threshold) / 100,
                maxMemories: Number(max),
              },
            }),
          t('notice.settingsSaved'),
        )

      return h(
        'div',
        { className: 'dspm-stack' },
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-card-title' },
            t('opt.title'),
            h(InfoHint, { text: t('opt.curve') }),
          ),
          h(
            'div',
            { className: 'dspm-grid-2' },
            h(
              Field,
              { label: t('opt.topK'), hint: t('opt.topKHint') },
              h('input', {
                className: 'dspm-input',
                type: 'number',
                min: 1,
                max: 30,
                value: topK,
                onChange: (event) => setTopK(event.target.value),
              }),
            ),
            h(
              Field,
              { label: t('opt.threshold'), hint: t('opt.thresholdHint') },
              h('input', {
                className: 'dspm-input',
                type: 'number',
                min: 1,
                max: 50,
                value: threshold,
                onChange: (event) => setThreshold(event.target.value),
              }),
            ),
          ),
          h(
            Field,
            { label: t('opt.max'), hint: t('opt.maxHint') },
            h('input', {
              className: 'dspm-input',
              type: 'number',
              min: 50,
              max: 2000,
              value: max,
              onChange: (event) => setMax(event.target.value),
            }),
          ),
          h('div', { className: 'dspm-actions' }, h(Btn, { variant: 'primary', onClick: save, disabled: busy }, t('btn.save'))),
        ),
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-card-title' },
            t('io.exportAll'),
            h(InfoHint, { text: t('io.hint') }),
          ),
          h(DataIO, { t, kind: 'all', run, busy }),
        ),
        h(
          'div',
          { className: 'dspm-card' },
          h(
            'div',
            { className: 'dspm-card-title' },
            t('update.title'),
            h(InfoHint, { text: t('update.hint') }),
          ),
          h(
            'div',
            { className: 'dspm-row' },
            h(
              'div',
              { className: 'dspm-update-text' },
              h('div', { className: 'dspm-row-title' }, t('update.current', { version: state.version || '?' })),
              h(
                'div',
                { className: 'dspm-update-status' + (update.status === 'error' ? ' is-error' : '') },
                updateStatus,
              ),
            ),
            h(
              Btn,
              { onClick: checkUpdate, disabled: update.status === 'checking' },
              update.status === 'checking' ? t('update.checking') : t('update.check'),
            ),
          ),
          update.status === 'done' && update.data.updateAvailable
            ? h(
                'div',
                { className: 'dspm-actions' },
                h(
                  'a',
                  {
                    className: 'dspm-lib-link',
                    href: update.data.repo,
                    target: '_blank',
                    rel: 'noreferrer',
                  },
                  t('update.repo'),
                ),
                h(InfoHint, { text: t('update.howto') }),
              )
            : null,
        ),
        h('p', { className: 'dspm-foot' }, t('opt.storage') + '：' + state.dataFile),
      )
    }

    /* ---------------------------------------------------------------- */
    /* Composer quick toggle                                             */
    /* ---------------------------------------------------------------- */

    function QuickToggle(props) {
      const t = props.t
      const snap = usePersona()
      const state = snap.state
      const [menu, setMenu] = useState(null)

      useEffect(() => {
        if (!menu) return undefined
        const close = () => setMenu(null)
        const onKey = (event) => {
          if (event.key === 'Escape') setMenu(null)
        }
        document.addEventListener('click', close)
        document.addEventListener('keydown', onKey)
        window.addEventListener('scroll', close, true)
        return () => {
          document.removeEventListener('click', close)
          document.removeEventListener('keydown', onKey)
          window.removeEventListener('scroll', close, true)
        }
      }, [menu])

      if (!state) return null
      const sessionId = props.sessionId ? String(props.sessionId) : ''
      if (!sessionId) return null
      const sessions = Array.isArray(state.settings.personaSessions) ? state.settings.personaSessions : []
      const enabled = sessions.includes(sessionId)
      const name = (state.activeCard && state.activeCard.name) || ''
      const cards = Array.isArray(state.cards) ? state.cards : []
      const activeCardId = state.activeCardId

      const toggleSession = () => {
        setMenu(null)
        store.mutate('/toggle', { sessionId, enabled: !enabled }).catch(() => {})
      }

      const activateCard = (id) => {
        setMenu(null)
        store.mutate('/card', { action: 'activate', id }).catch(() => {})
        if (!enabled) store.mutate('/toggle', { sessionId, enabled: true }).catch(() => {})
      }

      const openMenu = (event) => {
        event.preventDefault()
        event.stopPropagation()
        const width = 230
        const height = Math.min(360, 96 + cards.length * 34)
        setMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
        })
      }

      return h(
        'div',
        { className: 'dspm-chip-wrap' },
        h(
          'button',
          {
            type: 'button',
            className: 'dspm-chip' + (enabled ? ' is-on' : ''),
            title: t('chip.tip'),
            'aria-pressed': enabled ? 'true' : 'false',
            'aria-haspopup': 'menu',
            onClick: toggleSession,
            onContextMenu: openMenu,
          },
          h('span', { className: 'dspm-chip-dot' }),
          h(
            'span',
            { className: 'dspm-chip-text' },
            enabled ? t('chip.on', { name }) : t('chip.off'),
          ),
          h('span', { className: 'dspm-chip-state' }, enabled ? t('chip.stateOn') : t('chip.stateOff')),
        ),
        menu
          ? h(
              'div',
              {
                className: 'dspm-context-menu',
                style: { left: menu.x + 'px', top: menu.y + 'px' },
                onClick: (event) => event.stopPropagation(),
              },
              h(
                'div',
                { className: 'dspm-menu-title' },
                enabled ? t('menu.current', { name }) : t('menu.currentOff'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dspm-menu-item',
                  onClick: toggleSession,
                },
                enabled ? t('menu.turnOff') : t('menu.turnOn'),
              ),
              h('div', { className: 'dspm-menu-sep' }),
              h('div', { className: 'dspm-menu-title' }, t('menu.switchCard')),
              cards.map((card) =>
                h(
                  'button',
                  {
                    key: card.id,
                    type: 'button',
                    className: 'dspm-menu-item' + (card.id === activeCardId ? ' is-active' : ''),
                    onClick: () => activateCard(card.id),
                  },
                  h('span', { className: 'dspm-menu-name' }, card.name),
                  card.id === activeCardId ? h('span', { className: 'dspm-menu-check' }, '✓') : null,
                ),
              ),
            )
          : null,
      )
    }

    /* ---------------------------------------------------------------- */
    /* Styles                                                            */
    /* ---------------------------------------------------------------- */

    const STYLE_ID = 'dspm-persona-memory-styles'
    const CSS = `
.dspm-page { display: flex; flex-direction: column; gap: 16px; padding: 2px 2px 40px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.55; }
.dspm-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.dspm-hero-text { display: flex; flex-direction: column; gap: 4px; min-width: 220px; }
.dspm-title { margin: 0; font-size: 17px; font-weight: 600; }
.dspm-desc { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dspm-mode { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dspm-mode-text { display: flex; flex-direction: column; gap: 2px; max-width: 280px; }
.dspm-mode-state { font-weight: 600; color: var(--dsw-alias-label-secondary); }
.dspm-mode-state.is-on { color: var(--dsw-alias-state-success-primary); }
.dspm-mode-hint { display: inline-flex; align-items: center; gap: 5px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-switch-field { display: inline-flex; align-items: center; gap: 7px; flex: none; }
.dspm-switch-state { min-width: 1.4em; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-switch-state.is-on { color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-switch { position: relative; flex: none; width: 40px; height: 23px; padding: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-border-l2); cursor: pointer; transition: background .16s ease, border-color .16s ease; }
.dspm-switch.is-on { background: var(--dsw-alias-state-business-primary, #4176e6); border-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-switch:disabled { opacity: .5; cursor: default; }
.dspm-switch-thumb { position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: var(--dsw-alias-bg-base, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .16s ease; }
.dspm-switch.is-on .dspm-switch-thumb { transform: translateX(17px); background: var(--dsw-alias-bg-base, #fff); }
.dspm-tabs { display: flex; gap: 2px; padding: 3px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2); width: max-content; max-width: 100%; overflow-x: auto; }
.dspm-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); padding: 5px 16px; border-radius: 7px; cursor: pointer; font: inherit; white-space: nowrap; }
.dspm-tab.is-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.dspm-stack { display: flex; flex-direction: column; gap: 12px; }
.dspm-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dspm-card-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dspm-card-select { display: flex; flex-direction: column; gap: 5px; min-width: 220px; flex: 1; }
.dspm-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dspm-card-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.dspm-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dspm-subhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 4px; font-weight: 600; }
.dspm-subhead-text { display: inline-flex; align-items: center; gap: 6px; }
.dspm-trait { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-base); }
.dspm-trait-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dspm-trait-value { color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dspm-range { width: 100%; accent-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-section { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-base); }
.dspm-section-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dspm-section-label { flex: 1; min-width: 180px; }
.dspm-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.dspm-field-label { display: inline-flex; align-items: center; gap: 5px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dspm-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; margin: 0; }
.dspm-info { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none; width: 14px; height: 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; color: var(--dsw-alias-label-secondary); font-size: 9px; font-weight: 600; line-height: 1; cursor: help; }
.dspm-info:hover, .dspm-info:focus-visible { border-color: var(--dsw-alias-state-business-primary, #4176e6); color: var(--dsw-alias-state-business-primary, #4176e6); outline: none; }
.dspm-info::after { content: attr(data-tip); position: absolute; top: calc(100% + 7px); left: 50%; transform: translateX(-50%); z-index: 300; width: max-content; max-width: 280px; padding: 6px 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 8px 22px rgba(0,0,0,.2); font-size: 11px; font-weight: 400; line-height: 1.5; text-align: left; white-space: normal; opacity: 0; visibility: hidden; transition: opacity .12s ease; pointer-events: none; }
.dspm-info:hover::after, .dspm-info:focus-visible::after { opacity: 1; visibility: visible; }
.dspm-info.is-right::after { left: auto; right: 0; transform: none; }
.dspm-row-title-line { display: inline-flex; align-items: center; gap: 6px; }
.dspm-toolbar-label { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dspm-archived-head { display: inline-flex; align-items: center; gap: 6px; }
.dspm-input, .dspm-textarea, .dspm-select { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); padding: 7px 10px; font: inherit; outline: none; }
.dspm-textarea { resize: none; line-height: 1.55; }
.dspm-input:focus, .dspm-textarea:focus, .dspm-select:focus { border-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dspm-btn { padding: 6px 13px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
.dspm-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.dspm-btn:disabled { opacity: .5; cursor: default; }
.dspm-btn-primary { background: #ffffff; border-color: var(--dsw-alias-border-l2); color: #000000; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.14); }
.dspm-btn-primary:hover:not(:disabled) { background: #f2f2f2; border-color: var(--dsw-alias-border-l2); }
.dspm-btn-danger { color: var(--dsw-alias-state-error-primary); }
.dspm-notice { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); font-size: 12px; }
.dspm-notice.is-ok { border-color: var(--dsw-alias-state-success-primary); }
.dspm-notice.is-error { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dspm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.dspm-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); }
.dspm-stat-value { font-size: 19px; font-weight: 600; }
.dspm-stat-label { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dspm-search { max-width: 320px; }
.dspm-list { display: flex; flex-direction: column; gap: 10px; }
.dspm-mem { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); }
.dspm-mem.is-archived { opacity: .75; }
.dspm-mem-head { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; }
.dspm-mem-text { flex: 1; white-space: pre-wrap; word-break: break-word; }
.dspm-badges { display: flex; gap: 6px; flex: none; }
.dspm-badge { padding: 1px 7px; border-radius: 20px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 18px; white-space: nowrap; }
.dspm-badge.is-pinned { color: var(--dsw-alias-state-business-primary, #4176e6); border: 1px solid var(--dsw-alias-state-business-primary, #4176e6); background: transparent; }
.dspm-badge.is-due { color: var(--dsw-alias-state-warn-primary); border: 1px solid var(--dsw-alias-state-warn-primary); background: transparent; }
.dspm-mem-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-stars { color: var(--dsw-alias-state-warn-primary); letter-spacing: 1px; }
.dspm-tag, .dspm-tags .dspm-tag { padding: 0 6px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 18px; }
.dspm-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.dspm-meter { height: 5px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dspm-meter-fill { height: 100%; border-radius: 3px; background: var(--dsw-alias-state-business-primary, #4176e6); transition: width .3s ease; }
.dspm-meter-fill.is-mid { background: var(--dsw-alias-state-warn-primary); }
.dspm-meter-fill.is-low { background: var(--dsw-alias-state-error-primary); }
.dspm-mem-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.dspm-mem-actions .dspm-btn { padding: 3px 10px; font-size: 12px; }
.dspm-empty { padding: 26px 16px; text-align: center; color: var(--dsw-alias-label-secondary); border: 1px dashed var(--dsw-alias-border-l1); border-radius: 10px; }
.dspm-link { align-self: flex-start; border: 0; background: transparent; color: var(--dsw-alias-state-business-primary, #4176e6); font: inherit; cursor: pointer; padding: 0; }
.dspm-archived { display: flex; flex-direction: column; gap: 10px; }
.dspm-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dspm-row-title { font-weight: 500; }
.dspm-update-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dspm-update-status { color: var(--dsw-alias-label-secondary); font-size: 11px; word-break: break-word; }
.dspm-update-status.is-error { color: var(--dsw-alias-state-error-primary); }
.dspm-diary { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dspm-diary-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dspm-diary-date { color: var(--dsw-alias-label-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dspm-diary-title { font-weight: 600; flex: 1; min-width: 120px; }
.dspm-diary-body { margin: 0; white-space: pre-wrap; word-break: break-word; }
.dspm-diary-delete { padding: 2px 10px; font-size: 12px; }
.dspm-lib { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dspm-lib-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dspm-lib-title { flex: 1; min-width: 120px; font-weight: 600; word-break: break-word; }
.dspm-lib-body { margin: 0; max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
.dspm-lib-link { color: var(--dsw-alias-state-business-primary, #4176e6); font-size: 11px; text-decoration: none; word-break: break-all; }
.dspm-lib-link:hover { text-decoration: underline; }
.dspm-foot { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; word-break: break-all; }
.dspm-chip { display: inline-flex; align-items: center; gap: 7px; padding: 4px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; cursor: pointer; }
.dspm-chip.is-on { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dspm-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: none; }
.dspm-chip.is-on .dspm-chip-dot { background: var(--dsw-alias-state-success-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 22%, transparent); }
.dspm-chip-state { padding: 0 5px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); font-size: 10px; }
.dspm-chip:hover { border-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-chip-wrap { position: relative; display: inline-flex; }
.dspm-menu { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 30; min-width: 210px; padding: 5px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 10px 30px rgba(0,0,0,.18); display: flex; flex-direction: column; gap: 1px; }
.dspm-context-menu { position: fixed; z-index: 1200; min-width: 215px; max-height: 360px; overflow-y: auto; padding: 5px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 12px 34px rgba(0,0,0,.22); display: flex; flex-direction: column; gap: 1px; }
.dspm-menu-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px; }
.dspm-menu-title { padding: 5px 10px 6px; color: var(--dsw-alias-label-secondary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dspm-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 6px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.dspm-menu-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dspm-menu-item.is-active { color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-menu-check { font-size: 11px; }
.dspm-menu-sep { height: 1px; margin: 4px 2px; background: var(--dsw-alias-border-l1); }
.dspm-seg { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); width: max-content; max-width: 100%; overflow-x: auto; }
.dspm-seg-item { border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); padding: 5px 13px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.dspm-seg-item.is-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.dspm-seg-item:disabled { opacity: .55; cursor: default; }
.dspm-check-list { display: flex; flex-direction: column; gap: 8px; }
.dspm-check-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-base); }
.dspm-check-row.is-checked { border-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-check-row input[type="checkbox"] { flex: none; margin: 0; accent-color: var(--dsw-alias-state-business-primary, #4176e6); }
.dspm-check-main { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
.dspm-check-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dspm-check-title { font-weight: 500; }
.dspm-check-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; word-break: break-all; }
.dspm-io { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dspm-io-pending { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 5px 8px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 7px; }
.dspm-io-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-io-note { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dspm-hint.is-warn { color: var(--dsw-alias-state-warn-primary); }
@media (max-width: 640px) { .dspm-grid-2 { grid-template-columns: 1fr; } .dspm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`

    function installStyles(ctx) {
      ctx.effect(() => {
        if (document.getElementById(STYLE_ID)) return () => {}
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        ;(document.head || document.documentElement).appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'persona-memory: styles')
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'persona-memory: locale')
        installStyles(ctx)
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'persona-memory',
              order: 30,
              label: () => t('title'),
              locale: NS,
            },
            (slotProps) => h(SettingsPage, { ...slotProps, t }),
          ),
        )
        ctx.slots.inject('conversation.hero.options', () =>
          ctx.slots.register(
            {
              name: 'conversation.hero.options',
              id: 'persona-memory-switch-hero',
              order: 20,
            },
            (slotProps) => h(QuickToggle, { ...slotProps, t }),
          ),
        )
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'persona-memory-switch',
              order: 60,
            },
            (slotProps) => h(QuickToggle, { ...slotProps, t }),
          ),
        )
      },
    }
  },
})
