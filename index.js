import fs from "fs";

const identifyPreAndPostTokenBalances = async (tx, owner) => {

    const accountKeys = tx.transaction.message.accountKeys.map(key => key.pubkey.toString());
    // console.log("accountKeys.length", accountKeys.length);

    const ownerIndex = accountKeys.indexOf(owner);
    // console.log("index at which owner's token balance is expected", ownerIndex);

    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    // Create maps for pre and post balances
    const preBalanceMap = [];
    const postBalanceMap = [];
    const differenceBalanceMap = []; // calculate the difference between pre and post balances in a given transaction

    // Process pre-balances
    preBalances.forEach(balance => {
        if (balance.owner === owner) {
            preBalanceMap.push({
                owner: balance.owner,
                mint: balance.mint,
                uiAmount: balance.uiTokenAmount?.uiAmount || 0,
                decimals: balance.uiTokenAmount?.decimals
            });
        }
    });

    // Process post-balances
    postBalances.forEach(balance => {
        if (balance.owner === owner) {
            postBalanceMap.push({
                owner: balance.owner,
                mint: balance.mint,
                uiAmount: balance.uiTokenAmount?.uiAmount || 0,
                decimals: balance.uiTokenAmount?.decimals
            });
        }
    });

    // check postBalanceMap for owner, find common owner and mint in preBalanceMap
    postBalanceMap.forEach(balance => {
        const preBalance = preBalanceMap.find(b => b.mint === balance.mint && b.owner === balance.owner);
        // console.log("balance.uiAmount: ", balance.uiAmount, "preBalance.uiAmount: ", preBalance.uiAmount)
        if (preBalance) {
            differenceBalanceMap.push({
                owner: balance.owner,
                mint: balance.mint,
                change: (balance.uiAmount) - (preBalance.uiAmount),
                decimals: balance.decimals
            });
        }
    });

    console.log("differenceBalanceMap", differenceBalanceMap);

    // Sort changes to find input (negative) and output (positive) tokens
    const inputToken = differenceBalanceMap.find(c => c.change < 0);
    const outputToken = differenceBalanceMap.find(c => c.change > 0);

    return {
        inputToken: inputToken ? {
            amount: Math.abs(inputToken?.change || 0),
            mint: inputToken?.mint || '',
            owner: inputToken?.owner || '',
            decimals: inputToken?.decimals
        } : null,
        outputToken: outputToken ? {
            amount: Math.abs(outputToken?.change || 0),
            mint: outputToken?.mint || '',
            owner: outputToken?.owner || '',
            decimals: outputToken?.decimals
        } : null,
        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now()
    };
}

const identifyPreAndPostSolBalances = async (tx, owner) => {
    const accountKeys = tx.transaction.message.accountKeys.map(key => key.pubkey.toString());
    const ownerIndex = accountKeys.indexOf(owner);

    const preBalance = tx.meta?.preBalances[ownerIndex];
    const postBalance = tx.meta?.postBalances[ownerIndex];

    return {
        preBalance: preBalance,
        postBalance: postBalance,
        changeInLamports: postBalance - preBalance,
        changeInSol: (postBalance - preBalance) / 10**9
    }
}

async function main() {
    // parse tx using web3JS method: const tx = await web3.getParsedTransaction(txHash);
    const tx = JSON.parse(fs.readFileSync("tx.json", "utf8"));
    const owner = "3yBorbfiBL2hb4jWURrT2MTozjPbXstwm294UbC4JQLP"; // fix user making the transaction
    const result1 = await identifyPreAndPostTokenBalances(tx, owner);
    const result1SolBalance = await identifyPreAndPostSolBalances(tx, owner);
    console.log("result1SolBalance", result1SolBalance);


    const owner2 = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" // fix raydium authority
    const result2 = await identifyPreAndPostTokenBalances(tx, owner2);
    
    // now aggregate the results to common object, if inputToken is null, then use outputToken
    const aggregatedResult = {
        inputToken: result1.inputToken ? result1.inputToken : result2.outputToken,
        outputToken: result1.outputToken ? result1.outputToken : result2.inputToken,
        SolCostToUser: result1SolBalance.changeInSol,
        timestamp: result1.timestamp ? result1.timestamp : result2.timestamp
    };

    console.log("aggregatedResult", aggregatedResult);
}

main(); 