/** 依赖字段进入/离开动画。 */
(function (app) {
  'use strict';
  app.fieldMotion = function (cfg, suppressDependencyAnimation) {

    var dependencyGsapPromise = null;
    // 功能：按需加载 GSAP，依赖动画优先使用它，失败时交给 CSS 兜底。
    function Ensure_Dependency_Gsap() {
      if (window.gsap) { return Promise.resolve(window.gsap); }
      if (dependencyGsapPromise) { return dependencyGsapPromise; }
      dependencyGsapPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = cfg.gsapUrl || 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
        script.async = true;
        script.onload = function () { resolve(window.gsap); };
        script.onerror = function () { reject(new Error('GSAP load failed')); };
        document.head.appendChild(script);
      });
      return dependencyGsapPromise;
    }

    // 功能：清理依赖动画写入的内联样式，避免跳过动画时内容残留透明状态。
    function Clear_Dependency_Animation_Styles(el) {
      el.style.opacity = '';
      el.style.visibility = '';
      el.style.transform = '';
    }

    // 功能：依赖字段进入前设置初始状态，避免首帧闪烁。
    function Dependency_Before_Enter(el) {
      if (suppressDependencyAnimation.value) {
        Clear_Dependency_Animation_Styles(el);
        return;
      }
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px) scale(0.985)';
    }

    // 功能：依赖字段显示时执行展开动画。
    function Dependency_Enter(el, done) {
      if (suppressDependencyAnimation.value) {
        Clear_Dependency_Animation_Styles(el);
        done();
        return;
      }
      Ensure_Dependency_Gsap().then(function (gsap) {
        gsap.killTweensOf(el);
        gsap.fromTo(el, {
          autoAlpha: 0,
          y: -8,
          scale: 0.985,
        }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.24,
          ease: 'power2.out',
          clearProps: 'all',
          onComplete: done,
        });
      }).catch(function () {
        el.classList.add('eva-dependency-css-enter');
        window.requestAnimationFrame(function () {
          el.classList.add('is-active');
          window.setTimeout(function () {
            el.classList.remove('eva-dependency-css-enter', 'is-active');
            done();
          }, 260);
        });
      });
    }

    // 功能：依赖字段隐藏时执行收起动画。
    function Dependency_Leave(el, done) {
      if (window.gsap) { window.gsap.killTweensOf(el); }
      Clear_Dependency_Animation_Styles(el);
      done();
    }


    return { Dependency_Before_Enter: Dependency_Before_Enter, Dependency_Enter: Dependency_Enter, Dependency_Leave: Dependency_Leave };
  };
})(window.EvaApp = window.EvaApp || {});
