require('dotenv').config();
const { ethers } = require('ethers');
const { Token, Fetcher, Route, Trade, TokenAmount, TradeType, Percent } = require('@uniswap/sdk');
const { LendingPool, LendingPoolAddressesProvider, ERC20Service } = require('@aave/protocol-js');

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const UNI_ADDRESS = '0xf164fc0ec4e93095b804a4795bbe1e041497b92a' // Uniswap token address
const AAVE_LENDING_POOL_ADDRESS_PROVIDER = '0x24a42fD28C976A61Df5D00D0599C34c4f90748c8' // Aave LendingPoolAddressesProvider address

async function main() {
    // Fetch token data (USDC -> LINK)
    const USDC = new Token(1, '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', 6); // Example USDC address
    const LINK = new Token(1, '0x779877A7B0D9E8603169DdbD7836e478b4624789', 18); // Example LINK address

    const pair = await Fetcher.fetchPairData(USDC, LINK, provider);
    const route = new Route([pair], USDC);
    const trade = new Trade(route, new TokenAmount(USDC, ethers.utils.parseUnits('100', 6)), TradeType.EXACT_INPUT);

    // Perform the swap
    const slippageTolerance = new Percent('50', '10000'); // 0.5%
    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
    const path = [USDC.address, LINK.address];
    const to = wallet.address;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current time
    const value = trade.inputAmount.raw;

    const uniswapV2Router = new ethers.Contract(
        UNI_ADDRESS,
        [
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ],
        wallet
    );

    const tx = await uniswapV2Router.swapExactTokensForTokens(
        ethers.BigNumber.from(value.toString()),
        ethers.BigNumber.from(amountOutMin.toString()),
        path,
        to,
        deadline
    );

    await tx.wait();

    // Supply LINK on Aave
    const lendingPool = new LendingPool(provider, AAVE_LENDING_POOL_ADDRESS_PROVIDER);

    await lendingPool.deposit({
        user: wallet,
        reserve: LINK.address,
        amount: ethers.utils.parseUnits('100', 18),
        onBehalfOf: wallet.address
    });

    console.log('Swap and deposit successful');
}

main().catch(console.error);
 
