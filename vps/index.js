// file://D:\projects\nasdaq\vps\index.js

'use strict';

window.addEventListener('load', function () {
    const clickTargetButton = () => {
        const btn = document.querySelector('.button.button-a') || document.getElementById('noVNC_connect_button');

        if (btn) {
            btn.click();
        } else {
            setTimeout(clickTargetButton, 300);
        }
    };

    clickTargetButton();

    setInterval(() => {
        const statusElement = document.querySelector('#noVNC_transition_text');

        if (statusElement) {
            const statusText = statusElement.innerText.toLowerCase().trim();

            if (statusText.includes('reconnecting')) {
                location.reload();
            }
        }
    }, 1000);
});