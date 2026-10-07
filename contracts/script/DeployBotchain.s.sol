// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {QuestForge} from "../src/QuestForge.sol";
interface Vm { function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
contract DeployBotchain {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (QuestForge deployed) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey); deployed = new QuestForge(); vm.stopBroadcast();
    }
}
