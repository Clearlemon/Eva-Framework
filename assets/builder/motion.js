/** 构建器页签与模块分组动画。 */
(function (runtime) {
  'use strict';
  var loadGsap = runtime.loadGsap;
  var menuReducedMotion = runtime.menuReducedMotion;
  var stopMenuMotion = runtime.stopMenuMotion;
  var runModuleTabMotion = runtime.runModuleTabMotion;

  runtime.motion = {
    selectModuleTab: function (id) {
      if (this.moduleTab === id || !this.moduleTabs().some(function (tab) { return tab.id === id; })) { return; }
      this.moduleTab = id;
      this.collapsedGroups = {};
    },
    moveModuleTab: function (step) {
      var tabs = this.moduleTabs(), index = tabs.findIndex(function (tab) { return tab.id === this.moduleTab; }.bind(this));
      var next = step === 'first' ? 0 : step === 'last' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
      this.selectModuleTab(tabs[next].id);
      this.$nextTick(function () {
        var rail = this.$refs.moduleTabRail;
        var button = rail && rail.querySelector('[data-module-tab="' + this.moduleTab + '"]');
        if (button) { button.focus({ preventScroll: true }); }
      });
    },
    positionModuleTabIndicator: function (animate) {
      var seq = this._moduleTabIndicatorSeq = (this._moduleTabIndicatorSeq || 0) + 1;
      var place = function (gsap) {
        if (this._menuMotionDisposed || seq !== this._moduleTabIndicatorSeq) { return; }
        var rail = this.$refs.moduleTabRail, indicator = this.$refs.moduleTabIndicator;
        var button = rail && rail.querySelector('[data-module-tab="' + this.moduleTab + '"]');
        if (!button || !indicator || button.offsetWidth < 1) { return; }
        var values = { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight, opacity: 1 };
        if (gsap) {
          gsap.killTweensOf(indicator);
          if (animate && !menuReducedMotion()) { gsap.to(indicator, Object.assign(values, { duration: .28, ease: 'power3.out', overwrite: 'auto' })); }
          else { gsap.set(indicator, values); }
        } else {
          indicator.style.transform = 'translate(' + values.x + 'px,' + values.y + 'px)';
          indicator.style.width = values.width + 'px'; indicator.style.height = values.height + 'px'; indicator.style.opacity = '1';
        }
      }.bind(this);
      if (window.gsap) { place(window.gsap); }
      else { loadGsap().then(place).catch(function () { place(null); }); }
    },
    enterModuleTab: function (el, done) {
      var id = el.getAttribute('data-module-panel');
      runModuleTabMotion(this, el, done, true, { direction: this.moduleTabDirection, distance: Math.min(240, Math.max(60, el.offsetWidth * .75)), onComplete: function () { if (id === this.moduleTab) { this.moduleTabAnimating = false; } }.bind(this) });
    },
    leaveModuleTab: function (el, done) {
      var width = el.offsetWidth;
      el.style.width = width + 'px'; el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0';
      runModuleTabMotion(this, el, done, false, { direction: this.moduleTabDirection, distance: Math.min(240, Math.max(60, width * .75)) });
    },
    menuBeforeEnter: function (el) { stopMenuMotion(el, true); el.style.opacity = '0'; },
    // CSS handles staggered unfolding; restore natural heights after each transition.
    measureMenuRow: function (el) {
      el.style.setProperty('--eva-menu-row-height', (el.scrollHeight + 1) + 'px');
    },
    clearMenuRowHeight: function (el) {
      el.style.removeProperty('--eva-menu-row-height');
    },
    measureMenuDropdown: function (el) {
      el.style.setProperty('--eva-menu-dropdown-height', (el.scrollHeight + 2) + 'px');
    },
    clearMenuDropdownHeight: function (el) {
      el.style.removeProperty('--eva-menu-dropdown-height');
    },
    // Keep anchored controls positioned when they mount and finish sliding.
    menuAfterEnter: function (el) {
      if (this._menuMotionDisposed) { return; }
      if (el === this.$refs.menuActionsPanel) { this.positionMenuActions(); }
      else if (el === this.$refs.menuItemEditor) { this.positionMenuItemEditor(); }
      else if (el === this.$refs.menuLocationsPanel) { this.positionMenuLocations(); }
      else if (el === this.$refs.menuAddPanel) { this.positionMenuAddPanel(); }
      else if (el === this.$refs.menuSubmenuPanel) { this.positionMenuSubmenuPanel(); }
    },
    menuCancelMotion: function (el) { stopMenuMotion(el, true); },

    // 功能：分组展开前设置初始动画状态。
    beforeGroupEnter: function (el) {
      el.style.height = '0px';
      el.style.opacity = '0';
      el.style.overflow = 'hidden';
      el.style.transform = 'translateY(-6px)';
    },
    // 功能：使用 GSAP 展开组件分组。
    enterGroup: function (el, done) {
      loadGsap().then(function (gsap) {
        gsap.killTweensOf(el);
        gsap.to(el, {
          height: 'auto',
          opacity: 1,
          y: 0,
          duration: 0.32,
          ease: 'expo.out',
          clearProps: 'height,opacity,transform,overflow',
          onComplete: done
        });
      }).catch(function () {
        el.style.transition = 'height 260ms ease, opacity 220ms ease, transform 260ms ease';
        el.style.height = el.scrollHeight + 'px';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        window.setTimeout(done, 280);
      });
    },
    // 功能：使用 GSAP 收起组件分组。
    leaveGroup: function (el, done) {
      el.style.height = el.offsetHeight + 'px';
      el.style.overflow = 'hidden';
      loadGsap().then(function (gsap) {
        gsap.killTweensOf(el);
        gsap.to(el, {
          height: 0,
          opacity: 0,
          y: -6,
          duration: 0.24,
          ease: 'sine.inOut',
          clearProps: 'height,opacity,transform,overflow',
          onComplete: done
        });
      }).catch(function () {
        el.style.transition = 'height 240ms ease, opacity 200ms ease, transform 240ms ease';
        window.requestAnimationFrame(function () {
          el.style.height = '0px';
          el.style.opacity = '0';
          el.style.transform = 'translateY(-6px)';
        });
        window.setTimeout(done, 260);
      });
    },
    // 功能：分组动画结束后清理原生兜底样式。
    afterGroupAnimation: function (el) {
      el.style.transition = '';
      el.style.height = '';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.overflow = '';
    }
  };
})(window.EvaBuilder);
