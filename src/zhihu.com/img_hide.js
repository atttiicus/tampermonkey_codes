// ==UserScript==
// @name         知乎正文图片替换为预览按钮 (手动触发版)
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  点悬浮按钮：正文图变成"点击预览图片"占位元素，非正文图片全部隐藏
// @author       atttiicus
// @match        https://www.zhihu.com/*
// @match        https://zhuanlan.zhihu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============== 可配置项 ==============
    const PLACEHOLDER_SIZE = 100;   // 占位框边长（px），想改大改成 300 即可
    const HIDE_NON_CONTENT_IMGS = true; // 是否隐藏非正文图片

    const STYLE_ID = 'zhihu-img-placeholder-style';
    const HIDDEN_ATTR = 'data-zhihu-img-hidden';

    // 正文容器选择器：这些容器里的 img 视为"正文图片"，不隐藏
    const CONTENT_SELECTORS = [
        '.RichText',
        '.Post-RichText',
        '.ztext',
        '.RichText-ConditionalImagePortal',
    ].join(', ');

    // ============== CSS ==============
    const S = PLACEHOLDER_SIZE;
    const CSS_TEXT = `
        .RichText-ConditionalImagePortal:has(img) {
            position: relative !important;
            width: ${S}px !important;
            height: ${S}px !important;
            min-width: ${S}px !important;
            min-height: ${S}px !important;
            max-width: ${S}px !important;
            max-height: ${S}px !important;
            margin: 16px auto !important;
            padding: 0 !important;
            background-color: #f5f5f5 !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 8px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            transition: background-color 0.2s, border-color 0.2s;
        }
        .RichText-ConditionalImagePortal:has(img):hover {
            background-color: #e8e8e8 !important;
            border-color: #cccccc !important;
        }
        .RichText-ConditionalImagePortal:has(img) img {
            display: none !important;
        }
        .RichText-ConditionalImagePortal:has(img)::after {
            content: '点击预览图片';
            color: #999999;
            font-size: 12px;
            line-height: 1;
            user-select: none;
            pointer-events: none;
            text-align: center;
        }
    `;

    let isActive = false;
    let btn = null;
    let observer = null;
    let hideTimer = null;

    // ============== 非正文图片：隐藏 / 恢复 ==============
    function hideNonContentImages() {
        if (!HIDE_NON_CONTENT_IMGS) return;
        document.querySelectorAll('img:not([' + HIDDEN_ATTR + '])').forEach(img => {
            // 正文容器内的图片保留
            if (img.closest(CONTENT_SELECTORS)) return;
            // 已经处理过的跳过
            img.setAttribute(HIDDEN_ATTR, '1');
            img.style.setProperty('display', 'none', 'important');
        });
    }

    function restoreNonContentImages() {
        document.querySelectorAll('img[' + HIDDEN_ATTR + ']').forEach(img => {
            img.style.removeProperty('display');
            img.removeAttribute(HIDDEN_ATTR);
        });
    }

    // ============== 监听 DOM 变化（节流） ==============
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(() => {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideNonContentImages, 200);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (!observer) return;
        observer.disconnect();
        observer = null;
        clearTimeout(hideTimer);
    }

    // ============== 启用 / 关闭 ==============
    function enable() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(s);
        isActive = true;
        hideNonContentImages();
        startObserver();
        updateButton();
    }

    function disable() {
        const s = document.getElementById(STYLE_ID);
        if (s) s.remove();
        restoreNonContentImages();
        stopObserver();
        isActive = false;
        updateButton();
    }

    function toggle() {
        isActive ? disable() : enable();
    }

    // ============== 悬浮按钮 ==============
    function createButton() {
        btn = document.createElement('div');
        btn.id = 'zhihu-img-toggle-btn';
        btn.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 80px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background-color: #0084ff;
            color: #ffffff;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            cursor: pointer;
            z-index: 2147483647;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            user-select: none;
            transition: background-color 0.2s, transform 0.2s;
            line-height: 1.1;
            padding: 4px;
            box-sizing: border-box;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.08)'; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggle();
        });
        document.body.appendChild(btn);
        updateButton();
    }

    function updateButton() {
        if (!btn) return;
        if (isActive) {
            btn.textContent = '恢复';
            btn.style.backgroundColor = '#ff6b6b';
        } else {
            btn.textContent = '摸鱼';
            btn.style.backgroundColor = '#0084ff';
        }
    }

    // ============== 点击占位区域打开原图 ==============
    document.addEventListener(
        'click',
        function (e) {
            if (!isActive) return;
            const target = e.target;
            if (!target || !target.closest) return;

            const portal = target.closest('.RichText-ConditionalImagePortal');
            if (!portal) return;

            const img = portal.querySelector('img');
            if (!img) return;

            const src =
                img.dataset.original ||
                img.dataset.actualsrc ||
                img.dataset.src ||
                img.src;

            if (!src || src.startsWith('data:')) return;

            e.preventDefault();
            e.stopPropagation();
            window.open(src, '_blank');
        },
        true
    );

    // ============== 快捷键：Alt + M 切换 ==============
    document.addEventListener('keydown', function (e) {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            toggle();
        }
    });

    // ============== 初始化 ==============
    function init() {
        if (!document.body) {
            setTimeout(init, 200);
            return;
        }
        if (document.getElementById('zhihu-img-toggle-btn')) return;
        createButton();
    }

    init();

})();