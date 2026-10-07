// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {QuestForge} from "../src/QuestForge.sol";
interface Vm { function deal(address,uint256) external; function prank(address) external; function expectRevert(bytes4) external; }
contract QuestForgeTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    QuestForge questForge; address creator = address(0xCAFE); address hunter = address(0xBEEF);
    function setUp() public { questForge = new QuestForge(); vm.deal(creator, 10 ether); }
    function testCreateSubmitApproveAndPay() public {
        vm.prank(creator); uint256 id = questForge.createQuest{value: 2 ether}("Ship a tutorial", "Teach builders", "Public URL", uint64(block.timestamp + 1 days), 1 ether, 2);
        vm.prank(hunter); questForge.submitProof(id, "https://example.com/proof"); uint256 beforeBalance = hunter.balance;
        vm.prank(creator); questForge.approveSubmission(id, hunter); require(hunter.balance == beforeBalance + 1 ether, "reward not paid");
        (,, bool approved) = questForge.getSubmission(id, hunter); require(approved, "submission not approved");
    }
    function testRejectsDuplicateSubmission() public {
        vm.prank(creator); uint256 id = questForge.createQuest{value: 1 ether}("Quest", "Description", "Requirements", uint64(block.timestamp + 1 days), 1 ether, 1);
        vm.prank(hunter); questForge.submitProof(id, "proof"); vm.expectRevert(QuestForge.AlreadySubmitted.selector); vm.prank(hunter); questForge.submitProof(id, "again");
    }
    function testCreatorCanCancelAndRecoverRewards() public {
        vm.prank(creator); uint256 id = questForge.createQuest{value: 2 ether}("Quest", "Description", "Requirements", uint64(block.timestamp + 1 days), 1 ether, 2);
        uint256 beforeBalance = creator.balance; vm.prank(creator); questForge.cancelQuest(id); require(creator.balance == beforeBalance + 2 ether, "refund not returned");
    }
}
