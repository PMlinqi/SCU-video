// ==UserScript==
// @name         大川学堂自动续播（合规版）
// @namespace    https://ecourse.scu.edu.cn
// @version      1.0.0
// @description  视频真实播放结束后，自动点击平台自带的"下一个学习内容"按钮。不伪造进度、不跳播、不加速，仅省去手动点击。
// @author       ZCode
// @match        https://ecourse.scu.edu.cn/learn/course/detail/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ========== 配置 ==========
    const NEXT_BTN_TEXT = '下一个学习内容';      // 按钮文案
    const CLICK_DELAY = 1500;                    // 视频结束后延迟毫秒数（给平台留出记录时间）
    const MAX_RETRY = 10;                        // 找不到按钮时最多重试次数
    const RETRY_INTERVAL = 1000;                 // 重试间隔毫秒

    // ========== 查找元素 ==========

    // 找到"下一个学习内容"按钮（基于类名 + 文案，双保险）
    function findNextButton() {
        // 优先用类名匹配
        const candidates = document.querySelectorAll('.btn.next, .next.btn, [class*="next"][class*="btn"]');
        for (const el of candidates) {
            const text = (el.textContent || '').trim();
            if (text.includes(NEXT_BTN_TEXT)) {
                return el;
            }
        }
        // 兜底：全文搜索包含文案的可点击元素
        const all = document.querySelectorAll('div, button, span, a');
        for (const el of all) {
            const text = (el.textContent || '').trim();
            if (text === NEXT_BTN_TEXT || text.includes(NEXT_BTN_TEXT)) {
                // 往上找最近的、看起来可点击的容器
                let cur = el;
                while (cur && cur !== document.body) {
                    if (cur.classList && (cur.classList.contains('btn') || cur.classList.contains('next') || cur.tagName === 'BUTTON')) {
                        return cur;
                    }
                    cur = cur.parentElement;
                }
                return el;
            }
        }
        return null;
    }

    // 找到页面上的视频元素（xgplayer 内部是一个 <video>）
    function findVideo() {
        return document.querySelector('video');
    }

    // ========== 核心逻辑 ==========

    // 处理一次视频结束
    function handleEnded(video) {
        // 校验：必须是真实播放到结尾（避免误触）
        const dur = video.duration;
        const cur = video.currentTime;
        if (dur && cur >= dur - 1) {
            console.log('[自动续播] 视频真实播放结束，准备切换下一节...');
            clickNextWithRetry(0);
        }
    }

    // 带重试地点击"下一个学习内容"
    function clickNextWithRetry(attempt) {
        const btn = findNextButton();
        if (btn) {
            // 检查按钮是否可点击（某些平台结束瞬间按钮可能置灰）
            const disabled = btn.getAttribute('disabled') !== null ||
                (btn.classList && btn.classList.contains('is-disabled'));
            if (disabled && attempt < MAX_RETRY) {
                setTimeout(() => clickNextWithRetry(attempt + 1), RETRY_INTERVAL);
                return;
            }
            console.log('[自动续播] 点击按钮:', NEXT_BTN_TEXT);
            btn.click();
        } else if (attempt < MAX_RETRY) {
            // 按钮还没渲染出来，稍后重试
            setTimeout(() => clickNextWithRetry(attempt + 1), RETRY_INTERVAL);
        } else {
            console.warn('[自动续播] 未找到按钮:', NEXT_BTN_TEXT);
        }
    }

    // 给视频绑定 ended 监听（防止重复绑定）
    function attachVideo(video) {
        if (video.__autoNextBound) return;
        video.__autoNextBound = true;
        video.addEventListener('ended', () => {
            setTimeout(() => handleEnded(video), CLICK_DELAY);
        });
        console.log('[自动续播] 已监听视频结束事件');
    }

    // ========== 启动 & 监听动态变化 ==========
    // 平台是 Vue 应用，切换章节会重建 video 元素，所以需要持续监听

    function watch() {
        const video = findVideo();
        if (video) attachVideo(video);
    }

    // 初次绑定
    watch();

    // 用 MutationObserver 监听 DOM 变化（章节切换、播放器重建）
    const observer = new MutationObserver(watch);
    observer.observe(document.body, { childList: true, subtree: true });

    // 兜底：定时检查（防止某些情况下 observer 漏掉）
    setInterval(watch, 3000);

    console.log('[自动续播] 脚本已启动');
})();
