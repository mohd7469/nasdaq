(function () {
    'use strict';

    // ==========================================
    // --- AAP KI NAYI TEST VALUES ---
    // ==========================================
    const minVolume = [5000];
    const priceDifferenceThreshold = [50];
    const longReward = [0.5, 1.0, 1.5];
    const shortReward = [0.5, 0.6, 1.0];
    const use50PctEntryLong = [true, false];
    const use50PctEntryShort = [true, false];

    const totalPnLEl = '.positiveValue-bdNduTQM';
    const drawdownSectionEl = '.containerCell-dJrHEJrZ';

    // Helper function to wait
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Function to download CSV locally
    function downloadCSV(data) {
        let csvContent = "data:text/csv;charset=utf-8,MinVolume,PriceDiff,LongReward,ShortReward,Long50,Short50,TotalPnL,MaxDrawdown\n";
        data.forEach(row => {
            // sb ko excel formula text format (="value") mein convert karden
            let formattedRow = row.map(val => `="${val}"`);
            csvContent += formattedRow.join(",") + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "strategy_optimization_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Function to set value for React inputs without closing modal
    function setReactInputValue(inputElement, value) {
        if (!inputElement) return;
        inputElement.focus();

        const lastValue = inputElement.value;
        inputElement.value = value;

        let tracker = inputElement._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }

        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        inputElement.blur();
    }

    // Function to set checkbox value
    function setCheckboxState(checkboxElement, shouldBeChecked) {
        if (!checkboxElement) return;
        if (checkboxElement.checked !== shouldBeChecked) {
            checkboxElement.click();
        }
    }

    // Metrics extraction using exact requested selectors
    function getMetrics() {
        let totalPnL = "0";
        let maxDD = "0";

        try {
            // Total PnL extraction
            const pnlNode = document.querySelector(totalPnLEl) || document.querySelector('.negativeValue-bdNduTQM');
            if (pnlNode) {
                let valSpan = pnlNode.querySelector('[class*="value"]');
                totalPnL = valSpan ? valSpan.innerText.trim() : pnlNode.innerText.trim();
            }

            // Drawdown extraction from drawdownSectionEl[1] -> 2nd div -> span value
            const cells = document.querySelectorAll(drawdownSectionEl);
            if (cells.length > 1) {
                let ddDivs = cells[1].querySelectorAll(':scope > div');
                if (ddDivs.length >= 2) {
                    let valSpan = ddDivs[1].querySelector('[class*="value"]');
                    maxDD = valSpan ? valSpan.innerText.trim() : ddDivs[1].innerText.trim();
                }
            }

        } catch (e) {
            console.log("Error reading metrics: ", e);
        }

        if (maxDD && maxDD !== "0" && !maxDD.startsWith("-")) {
            maxDD = "-" + maxDD;
        }

        return {
            totalPnL: totalPnL.toString(),
            maxDD: maxDD.toString()
        };
    }

    // Main optimization runner function
    async function runOptimizer() {
        console.log("Optimization started automatically with your values...");

        let numberInputs = document.querySelectorAll('[data-qa-id="ui-lib-Input-input"]');
        let checkboxes = document.querySelectorAll('input[type="checkbox"]');

        if (numberInputs.length < 4) {
            alert("Please open strategy settings modal and try again!");
            return;
        }

        let volInput = numberInputs[0];
        let pdInput = numberInputs[1];
        let lrInput = numberInputs[2];
        let srInput = numberInputs[3];

        let l50Checkbox = checkboxes[0];
        let s50Checkbox = checkboxes[1];

        let results = [];
        let totalCombinations = minVolume.length * priceDifferenceThreshold.length * longReward.length * shortReward.length * use50PctEntryLong.length * use50PctEntryShort.length;
        console.log("Total combinations to test: " + totalCombinations);

        let counter = 0;

        for (let vol of minVolume) {
            for (let pd of priceDifferenceThreshold) {
                for (let lr of longReward) {
                    for (let sr of shortReward) {
                        for (let l50 of use50PctEntryLong) {
                            for (let s50 of use50PctEntryShort) {
                                counter++;
                                console.log(`[${counter}/${totalCombinations}] Testing: MinVol=${vol}, PriceDiff=${pd}, LongReward=${lr}, ShortReward=${sr}, Long50=${l50}, Short50=${s50}`);

                                setReactInputValue(volInput, vol);
                                setReactInputValue(pdInput, pd);
                                setReactInputValue(lrInput, lr);
                                setReactInputValue(srInput, sr);

                                setCheckboxState(l50Checkbox, l50);
                                setCheckboxState(s50Checkbox, s50);

                                // TradingView engine ko calculate karne ke liye 2.5 seconds dena
                                await sleep(2500);

                                let metrics = getMetrics();
                                console.log(`Result -> PnL: ${metrics.totalPnL}, MaxDD: ${metrics.maxDD}`);

                                results.push([vol, pd, lr, sr, l50, s50, metrics.totalPnL, metrics.maxDD]);
                            }
                        }
                    }
                }
            }
        }

        downloadCSV(results);
        alert("Optimization complete! CSV file downloaded.");
    }

    console.log("Optimizer script loaded. Waiting 10 seconds for you to open the settings modal...");
    setTimeout(() => {
        runOptimizer();
    }, 10000);

})();