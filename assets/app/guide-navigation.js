/** 指南目录、分组、翻页和锚点导航。 */
(function (app) {
  'use strict';
  app.guideNavigation = function (guide, menu, openGuideGroups) {

    var guideSections = [];
    guide.groups.forEach(function (g) {
      (g.sections || []).forEach(function (s) {
        guideSections.push(Object.assign({}, s, {
          anchor: 'eva-guide-' + g.id + '-' + s.id,
          groupId: g.id,
          groupLabel: g.label,
          groupIcon: g.icon,
          groupDesc: g.desc,
        }));
      });
    });
    var activeGuideAnchor = Vue.ref(guideSections.length ? guideSections[0].anchor : '');

    // 左栏目录：按分组列出小节；“字段”分组末尾附上字段展示页的跳转项。
    var guideOutline = Vue.computed(function () {
      var fieldMenu = menu.filter(function (item) { return item.id === 'field-showcase'; })[0] || {};
      var fieldChildren = Array.isArray(fieldMenu.children) ? fieldMenu.children : [];
      return guide.groups.map(function (g) {
        var items = (g.sections || []).map(function (s) {
          return {
            key: g.id + '-' + s.id,
            label: s.title,
            icon: s.icon || g.icon,
            anchor: 'eva-guide-' + g.id + '-' + s.id,
          };
        });
        var menus = [];
        if (g.id === 'fields') {
          var seen = {};
          (g.sections || []).forEach(function (s) { seen[s.id] = true; });
          fieldChildren.forEach(function (item) {
            if (!item || !item.id || seen[item.id]) { return; }
            seen[item.id] = true;
            menus.push({
              key: 'menu-' + item.id,
              menuId: item.id,
              label: item.label,
              icon: item.icon || 'ri-input-method-line',
            });
          });
        }
        return { id: g.id, label: g.label, icon: g.icon, desc: g.desc, items: items, menus: menus };
      });
    });

    // 目录分组折叠：没手动收过的分组默认展开。
    function isGuideGroupOpen(id) { return openGuideGroups[id] !== false; }
    function toggleGuideGroup(id) { openGuideGroups[id] = !isGuideGroupOpen(id); }

    // 当前选中的小节；正文只渲染它一节，包成数组是为了复用原来的卡片模板
    var currentGuideSection = Vue.computed(function () {
      return guideSections.filter(function (s) { return s.anchor === activeGuideAnchor.value; })[0] || guideSections[0] || null;
    });
    var visibleGuideSections = Vue.computed(function () {
      return currentGuideSection.value ? [currentGuideSection.value] : [];
    });

    // 切换式下没法一路往下读，正文底部给一组前后翻页（跨分组按目录顺序）
    var guideNav = Vue.computed(function () {
      var idx = guideSections.indexOf(currentGuideSection.value);
      return {
        prev: idx > 0 ? guideSections[idx - 1] : null,
        next: (idx > -1 && idx < guideSections.length - 1) ? guideSections[idx + 1] : null,
      };
    });

    // 当前小节所在的分组，用于收起时把分组标题标成选中色
    var activeGuideGroupId = Vue.computed(function () {
      return currentGuideSection.value ? currentGuideSection.value.groupId : '';
    });

    // 点目录：直接切换正文，不再整页平铺靠滚动定位。
    // 若用户已经滚过正文顶部，切完把正文区带回视野，免得看到半截内容。
    var guideScrollHost = null;
    function selectGuideSection(anchor) {
      if (!anchor || activeGuideAnchor.value === anchor) { return; }
      activeGuideAnchor.value = anchor;
      Vue.nextTick(function () {
        var host = guideScrollHost || document.querySelector('.eva-content');
        var grid = document.querySelector('.eva-guide-grid');
        if (!host || !grid) { return; }
        var top = grid.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop - 8;
        if (host.scrollTop > top) { host.scrollTop = Math.max(0, top); }
      });
    }
    Vue.onMounted(function () { guideScrollHost = document.querySelector('.eva-content'); });
    Vue.onBeforeUnmount(function () { guideScrollHost = null; });


    return { guideSections: guideSections, activeGuideAnchor: activeGuideAnchor, guideOutline: guideOutline, isGuideGroupOpen: isGuideGroupOpen, toggleGuideGroup: toggleGuideGroup, visibleGuideSections: visibleGuideSections, guideNav: guideNav, activeGuideGroupId: activeGuideGroupId, selectGuideSection: selectGuideSection };
  };
})(window.EvaApp = window.EvaApp || {});
