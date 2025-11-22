export const parseTransactionText = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const transactions = [];

    // Regex patterns
    // Format A: DD Mon, HH:mm (Start of block, no year)
    const dateStartPattern = /\b(\d{1,2}|[lI]{1,2})\s+([A-Za-z]{3})[.,]?\s+(\d{2}:\d{2})\b/;

    // Format B: DD Mon YYYY (End of block, has year)
    // Relaxed: Allow missing space between day/month, allow '5ep' etc.
    const dateEndPattern = /\b(\d{1,2})\s*([A-Za-z0-9]{3})\s+(\d{4})\b/;

    // Amount: -RM6.50 or RM6.50 or - RM 6.50
    // Relaxed: Allow space after negative sign
    const amountPattern = /(-?)\s*(?:RM|Rm|rm|R\sM)?\s?([\d,]+\.\d{2})/i;

    // Header Date Range (for Format A fallback): 23 Oct 25 - 21 Nov 25
    const headerDatePattern = /\d{1,2}\s+[A-Za-z]{3}\s+(\d{2,4})/;

    let currentYear = new Date().getFullYear();
    // Try to find a year in the first few lines for Format A
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const match = lines[i].match(headerDatePattern);
        if (match) {
            const y = parseInt(match[1]);
            currentYear = y < 100 ? 2000 + y : y;
            break;
        }
    }

    let buffer = [];

    const processBuffer = (bufLines, dateMatch, isFormatA) => {
        if (bufLines.length === 0) return;

        let amount = null;
        let type = 'Income';
        let merchantLines = [];
        let dateStr = '';

        // Extract Date
        if (dateMatch) {
            const day = dateMatch[1].replace(/[lI]/g, '1').replace(/O/g, '0');
            let monthStr = dateMatch[2];

            // Fix common OCR month errors
            monthStr = monthStr.replace(/5ep/i, 'Sep')
                .replace(/0ct/i, 'Oct')
                .replace(/1an/i, 'Jan');

            const monthIndex = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(monthStr) / 3;

            let year = currentYear;
            if (!isFormatA && dateMatch[3]) {
                // Format B has year in group 3
                year = parseInt(dateMatch[3]);
            }

            if (monthIndex >= 0) {
                const dateObj = new Date(year, monthIndex, day, 12, 0, 0);
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                dateStr = `${y}-${m}-${d}`;
            }
        }

        // Find Amount and Merchant
        bufLines.forEach(line => {
            // Skip the date line itself if it's just the date
            if (isFormatA && dateStartPattern.test(line)) return;
            if (!isFormatA && dateEndPattern.test(line)) return;

            const amtMatch = line.match(amountPattern);
            if (amtMatch && amount === null) {
                const isNegative = amtMatch[1] === '-';
                amount = parseFloat(amtMatch[2].replace(/,/g, ''));
                type = isNegative ? 'Expense' : 'Income';

                // Optional: Remove amount from line for cleaner merchant name?
                // For now, let's keep the line but maybe clean up common noise
                let cleanLine = line.replace(amtMatch[0], '').trim();
                if (cleanLine) merchantLines.push(cleanLine);
            } else {
                // Just text
                const isNoise = /points|DuitNow|Payment/i.test(line); // Relaxed noise filter

                // If line is just date, skip (double check)
                if (dateStartPattern.test(line) || dateEndPattern.test(line)) return;

                if (!isNoise && line.trim().length > 0) {
                    merchantLines.push(line.trim());
                }
            }
        });

        if (amount !== null && dateStr) {
            let merchant = merchantLines.join(' ').trim();
            if (!merchant) merchant = "Unknown Transaction";

            transactions.push({
                date: dateStr,
                merchant: merchant,
                amount: amount,
                category: 'Uncategorized',
                type: type,
                accountId: 'default'
            });
        }
    };

    lines.forEach(line => {
        const startMatch = line.match(dateStartPattern);
        const endMatch = line.match(dateEndPattern);

        if (startMatch) {
            // Format A: Date starts the block.
            if (buffer.length > 0) {
                processBuffer(buffer, buffer[0].match(dateStartPattern), true);
            }
            buffer = [line];
        } else if (endMatch) {
            // Format B: Date ends the block.
            buffer.push(line);
            processBuffer(buffer, endMatch, false);
            buffer = [];
        } else {
            buffer.push(line);
        }
    });

    // Final flush for Format A (last transaction)
    if (buffer.length > 0) {
        const startMatch = buffer[0].match(dateStartPattern);
        if (startMatch) {
            processBuffer(buffer, startMatch, true);
        }
    }

    return transactions;
};
