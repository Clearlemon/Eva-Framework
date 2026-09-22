/**
 * 「可用小工具」来源筛选标签：在 #widget-list 上方插一排「全部 / Eva / 原生」。
 *
 * 由 Widget::enqueue 载入，且只在两个条件同时成立时才有这个脚本：当前是经典小工具页
 * （widgets.php，定制器里没有「可用小工具」这个列表），且站点确实注册了 Eva 小工具容器。
 *
 * 判定谁是 Eva 小工具，靠 PHP 注入的 window.EvaWidgetFilter.bases（各容器的 id_base），
 * 和 DOM 里每个列表项的隐藏输入 .id_base 比对——不靠标题文字或 class 猜。
 *
 * 分寸：只插入标签自己这一个元素，原生列表项一个样式都不碰，筛选纯靠切 display。
 */
(function () {
  var data = window.EvaWidgetFilter;

  // 没有容器清单（或清单是空的）就什么都不做，页面保持 WordPress 原样。
  if (!data || !data.bases || !data.bases.length) {
    return;
  }

  // 选中的分组只是个人一时的查看偏好，记在 sessionStorage 即可（关标签页就忘）。
  var STORE_KEY = 'eva-widget-filter';
  var GROUPS = ['all', 'eva', 'native'];

  /**
   * 取界面文案。嵌入式页面没有 EvaFW.config.messages，
   * EvaI18n.t 会回落到 eva-embed.js 里那份最小字典，再不济返回 key 本身。
   *
   * @param {string} key 文案 key。
   * @return {string}
   */
  function t(key) {
    return (window.EvaI18n && window.EvaI18n.t) ? window.EvaI18n.t(key) : key;
  }

  /**
   * 读取上次选中的分组。隐私模式下 sessionStorage 可能直接抛错，所以包起来。
   *
   * @return {string|null}
   */
  function readStored() {
    try {
      return window.sessionStorage.getItem(STORE_KEY);
    } catch (e) {
      return null;
    }
  }

  /**
   * 记住当前分组；存不进去也不影响筛选本身。
   *
   * @param {string} value 分组 key。
   */
  function writeStored(value) {
    try {
      window.sessionStorage.setItem(STORE_KEY, value);
    } catch (e) {
      // 忽略：存储不可用时筛选照常工作，只是刷新后回到「全部」。
    }
  }

  /**
   * 兜底：隐藏输入缺失时从元素 id 里取 id_base。
   * 可用列表项的 id 形如 widget-3_<id_base>-__i__。
   *
   * @param {string} id 元素 id。
   * @return {string}
   */
  function idBaseFromId(id) {
    var matched = /^widget-\d+_(.+)-__i__$/.exec(id || '');
    return matched ? matched[1] : '';
  }

  /**
   * 读「取消 / 添加小工具」两颗原按钮的文案，拿来当代理按钮的可访问名称。
   *
   * WordPress 的 .widgets-chooser 是页面上唯一的一个，页面加载时就建好挂在
   * #wpbody-content 下（点开某张卡片时才移动进去），所以这里读得到，
   * 也就不必自己再存一份译文——跟着 WP 后台的语言走。
   *
   * @return {{cancel: string, add: string}|null} 读不到时返回 null。
   */
  function chooserLabels() {
    var chooser = document.querySelector('.widgets-chooser');
    if (!chooser) {
      return null;
    }

    var cancel = chooser.querySelector('.widgets-chooser-cancel');
    var add = chooser.querySelector('.widgets-chooser-add');
    if (!cancel || !add) {
      return null;
    }

    var labels = { cancel: cancel.textContent.trim(), add: add.textContent.trim() };
    // 文案缺一个就整体放弃，宁可留着 WP 原来那两颗按钮，也不要没有名字的图标按钮。
    return (labels.cancel && labels.add) ? labels : null;
  }

  /**
   * 在一张 Eva 卡片的标题行里装上「取消 / 添加」的代理图标按钮（排在折叠箭头左边）。
   *
   * 为什么是代理而不是把原按钮搬过来：WP 把 click 委托在 .widgets-chooser 上，
   * 按 event.target 的 class 分派（button-primary → 添加，widgets-chooser-cancel → 取消）。
   * 按钮移出 chooser 就收不到事件了，所以这里点的是原按钮本身，让事件从它冒泡回 chooser。
   * 原按钮只是用 CSS 藏起来，没有从 DOM 里拿走。
   *
   * @param {HTMLElement} card   一张可用小工具卡片。
   * @param {{cancel: string, add: string}} labels 两颗按钮的可访问名称。
   */
  function addChooserProxy(card, labels) {
    var top = card.querySelector('.widget-top');
    if (!top || top.querySelector('.eva-chooser-proxy')) {
      return;
    }

    var group = document.createElement('div');
    group.className = 'eva-chooser-proxy';

    var defs = [
      { key: 'cancel', icon: 'ri-close-line', label: labels.cancel, target: '.widgets-chooser-cancel' },
      { key: 'add', icon: 'ri-check-line', label: labels.add, target: '.widgets-chooser-add' }
    ];

    for (var i = 0; i < defs.length; i++) {
      (function (def) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'eva-chooser-proxy-btn is-' + def.key;
        btn.setAttribute('aria-label', def.label);
        btn.title = def.label;

        var icon = document.createElement('i');
        icon.className = def.icon;
        icon.setAttribute('aria-hidden', 'true');
        btn.appendChild(icon);

        btn.addEventListener('click', function (event) {
          event.preventDefault();
          // 不能让点击冒到 .widget-top —— WP 在那上面绑了「开 / 关 chooser」。
          event.stopPropagation();

          // chooser 此刻就在这张卡片里，原按钮点下去事件会冒泡回 chooser 被分派。
          var real = card.querySelector(def.target);
          if (real) {
            real.click();
          }
        });

        group.appendChild(btn);
      })(defs[i]);
    }

    // 位置由 CSS 的 order 决定（标题 1 / 代理组 2 / 折叠箭头 3），不依赖这里的插入顺序。
    top.appendChild(group);

    // 这个类是「原按钮可以藏了」的开关：装不上代理就不加类，WP 自己那两颗按钮照常显示，
    // 不会出现两边都没有的情况。
    card.className += ' eva-chooser-proxied';
  }

  /**
   * 给每个可用小工具打上来源标记。
   *
   * @param {HTMLElement} list #widget-list。
   * @return {{items: Array<HTMLElement>, evaCount: number}}
   */
  function markItems(list) {
    var items = [];
    var evaCount = 0;
    var children = list.children;
    var labels = chooserLabels();

    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      // 只认直接子元素里的列表项，别把 .widget 内部的结构也算进来。
      if (el.className.indexOf('widget') === -1) {
        continue;
      }

      var input = el.querySelector('.id_base');
      var base = input ? input.value : idBaseFromId(el.id);
      var isEva = data.bases.indexOf(base) > -1;

      el.setAttribute('data-eva-source', isEva ? 'eva' : 'native');
      if (isEva) {
        evaCount++;
        // 读不到原按钮文案就不装代理，WP 自己那两颗按钮照常显示（CSS 的隐藏规则
        // 和代理按钮是一套，缺了代理也只是回到原生样子，不会两边都没有）。
        if (labels) {
          addChooserProxy(el, labels);
        }
      }
      items.push(el);
    }

    return { items: items, evaCount: evaCount };
  }

  /**
   * 按分组筛选列表：命中的显示并按原顺序排在前面，没命中的隐藏并挪到末尾。
   *
   * 为什么要动 DOM 顺序：WordPress 在 ≥1250px 时用 float 分两列，靠
   * #available-widgets .widget:nth-child(2n+1) { clear: both } 决定谁另起一行，
   * 而 :nth-child 按 DOM 位置算、不跳过 display:none 的项——只隐藏不重排的话，
   * 藏掉靠前的一项就会让后面所有项的奇偶性错位，列表里空出格子。
   * 把隐藏项挪到末尾，可见项的序号就始终是连续的 1..N，不用去改 WP 的布局。
   *
   * appendChild 是移动而不是重建，元素上的 jQuery 事件与 draggable 绑定都跟着走。
   *
   * @param {HTMLElement}        list  #widget-list。
   * @param {Array<HTMLElement>} items 全部列表项（始终保持原始顺序）。
   * @param {string}             group 分组 key。
   */
  function apply(list, items, group) {
    var visible = document.createDocumentFragment();
    var hidden = document.createDocumentFragment();

    for (var i = 0; i < items.length; i++) {
      var show = group === 'all' || items[i].getAttribute('data-eva-source') === group;
      items[i].style.display = show ? '' : 'none';
      (show ? visible : hidden).appendChild(items[i]);
    }

    // 先可见后隐藏，两段内部都仍是 items 的原始顺序，切回「全部」即完全复原。
    list.appendChild(visible);
    list.appendChild(hidden);
  }

  /**
   * chooser 一开一关，跟着禁用 / 恢复筛选标签。
   *
   * 为什么要禁：打开 chooser 时 WP 会给 #widgets-left 加 .chooser，其余小工具变成
   * opacity: .2 + pointer-events: none。这会儿要是切了分组，正在选侧栏的那张卡会被
   * 筛掉或挪到列表末尾，chooser 就悬在半空——人还以为能接着点别的小工具。
   *
   * 判据就用 WP 自己加的那个 class，不依赖它的内部事件。容器上的 pointer-events: none
   * 挡鼠标，按钮的 disabled 挡键盘（光靠 pointer-events，Tab 过去照样能回车）。
   *
   * @param {HTMLElement}        wrap    标签容器。
   * @param {Array<HTMLElement>} buttons 三颗标签按钮。
   */
  function watchChooser(wrap, buttons) {
    var left = document.getElementById('widgets-left');
    if (!left || typeof MutationObserver === 'undefined') {
      return;
    }

    function sync() {
      var choosing = left.classList.contains('chooser');
      wrap.className = 'eva-widget-filter' + (choosing ? ' is-disabled' : '');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].disabled = choosing;
      }
    }

    new MutationObserver(sync).observe(left, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  function init() {
    var list = document.getElementById('widget-list');

    // 列表不在（非小工具页），或者已经插过一次（脚本被重复载入），都直接退出。
    if (!list || document.querySelector('.eva-widget-filter')) {
      return;
    }

    var marked = markItems(list);

    // 容器注册了但列表里一个都没匹配上：不插标签，免得出现一个必然为空的分组。
    if (!marked.evaCount) {
      return;
    }

    var counts = {
      all: marked.items.length,
      eva: marked.evaCount,
      native: marked.items.length - marked.evaCount
    };
    var labels = { all: t('wgf_all'), eva: t('wgf_eva'), native: t('wgf_native') };

    var wrap = document.createElement('div');
    wrap.className = 'eva-widget-filter';
    wrap.setAttribute('role', 'tablist');
    wrap.setAttribute('aria-label', t('wgf_label'));

    var buttons = [];
    var stored = readStored();
    var current = GROUPS.indexOf(stored) > -1 ? stored : 'all';

    /**
     * 切到某个分组：更新按钮状态、筛选列表、记住选择。
     *
     * @param {string} key 分组 key。
     */
    function select(key) {
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute('data-eva-group') === key;
        buttons[i].className = 'eva-widget-filter-tab' + (on ? ' is-active' : '');
        buttons[i].setAttribute('aria-selected', on ? 'true' : 'false');
        // tablist 的常规做法：只有选中项参与 Tab 键顺序，组内用左右键移动。
        buttons[i].tabIndex = on ? 0 : -1;
      }
      apply(list, marked.items, key);
      writeStored(key);
    }

    for (var g = 0; g < GROUPS.length; g++) {
      (function (key) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'eva-widget-filter-tab';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('data-eva-group', key);
        btn.appendChild(document.createTextNode(labels[key]));

        var badge = document.createElement('span');
        badge.className = 'eva-widget-filter-count';
        badge.appendChild(document.createTextNode(String(counts[key])));
        btn.appendChild(badge);

        btn.addEventListener('click', function () {
          select(key);
        });

        wrap.appendChild(btn);
        buttons.push(btn);
      })(GROUPS[g]);
    }

    // 左右方向键在标签之间移动焦点并切换，符合 role="tablist" 的键盘预期。
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }

      var index = -1;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] === document.activeElement) {
          index = i;
        }
      }
      if (index < 0) {
        return;
      }

      e.preventDefault();
      var step = e.key === 'ArrowRight' ? 1 : buttons.length - 1;
      var next = buttons[(index + step) % buttons.length];
      next.focus();
      select(next.getAttribute('data-eva-group'));
    });

    // 插在列表正上方（「可用小工具」的说明文字之下）。
    list.parentNode.insertBefore(wrap, list);
    select(current);

    // 选侧栏的过程中锁住分组切换。
    watchChooser(wrap, buttons);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
