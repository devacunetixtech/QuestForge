// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract QuestForge {
    struct Quest { address creator; string title; string description; string requirements; uint64 deadline; uint96 rewardPerWinner; uint32 maxWinners; uint32 winners; bool cancelled; }
    struct Submission { string proof; uint64 submittedAt; bool approved; }

    uint256 public questCount;
    mapping(uint256 => Quest) private quests;
    mapping(uint256 => mapping(address => Submission)) private submissions;
    uint256 private locked = 1;

    error InvalidQuest(); error InvalidDeadline(); error InvalidReward(); error InvalidContent(); error NotCreator(); error QuestClosed(); error QuestExpired(); error AlreadySubmitted(); error MissingSubmission(); error AlreadyApproved(); error TransferFailed();
    event QuestCreated(uint256 indexed questId, address indexed creator, uint256 rewardPerWinner, uint256 maxWinners, uint256 deadline);
    event ProofSubmitted(uint256 indexed questId, address indexed participant, string proof);
    event SubmissionApproved(uint256 indexed questId, address indexed participant, uint256 reward);
    event QuestCancelled(uint256 indexed questId, uint256 refund);

    modifier nonReentrant() { require(locked == 1, "REENTRANCY"); locked = 2; _; locked = 1; }

    function createQuest(string calldata title, string calldata description, string calldata requirements, uint64 deadline, uint96 rewardPerWinner, uint32 maxWinners) external payable returns (uint256 questId) {
        if (bytes(title).length == 0 || bytes(description).length == 0 || bytes(requirements).length == 0) revert InvalidContent();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (rewardPerWinner == 0 || maxWinners == 0 || msg.value != uint256(rewardPerWinner) * maxWinners) revert InvalidReward();
        questId = ++questCount;
        quests[questId] = Quest(msg.sender, title, description, requirements, deadline, rewardPerWinner, maxWinners, 0, false);
        emit QuestCreated(questId, msg.sender, rewardPerWinner, maxWinners, deadline);
    }

    function submitProof(uint256 questId, string calldata proof) external {
        Quest storage quest = quests[questId];
        if (quest.creator == address(0)) revert InvalidQuest();
        if (quest.cancelled || quest.winners >= quest.maxWinners) revert QuestClosed();
        if (block.timestamp > quest.deadline) revert QuestExpired();
        if (bytes(proof).length == 0) revert InvalidContent();
        if (submissions[questId][msg.sender].submittedAt != 0) revert AlreadySubmitted();
        submissions[questId][msg.sender] = Submission(proof, uint64(block.timestamp), false);
        emit ProofSubmitted(questId, msg.sender, proof);
    }

    function approveSubmission(uint256 questId, address participant) external nonReentrant {
        Quest storage quest = quests[questId];
        if (msg.sender != quest.creator) revert NotCreator();
        if (quest.cancelled || quest.winners >= quest.maxWinners) revert QuestClosed();
        Submission storage submission = submissions[questId][participant];
        if (submission.submittedAt == 0) revert MissingSubmission();
        if (submission.approved) revert AlreadyApproved();
        submission.approved = true; quest.winners++;
        (bool sent,) = participant.call{value: quest.rewardPerWinner}("");
        if (!sent) revert TransferFailed();
        emit SubmissionApproved(questId, participant, quest.rewardPerWinner);
    }

    function cancelQuest(uint256 questId) external nonReentrant {
        Quest storage quest = quests[questId];
        if (msg.sender != quest.creator) revert NotCreator();
        if (quest.cancelled || quest.winners >= quest.maxWinners) revert QuestClosed();
        quest.cancelled = true;
        uint256 refund = uint256(quest.rewardPerWinner) * (quest.maxWinners - quest.winners);
        (bool sent,) = quest.creator.call{value: refund}("");
        if (!sent) revert TransferFailed();
        emit QuestCancelled(questId, refund);
    }

    function getQuest(uint256 questId) external view returns (address creator, string memory title, string memory description, string memory requirements, uint64 deadline, uint256 rewardPerWinner, uint32 maxWinners, uint32 winners, bool cancelled) {
        Quest storage q = quests[questId]; if (q.creator == address(0)) revert InvalidQuest();
        return (q.creator, q.title, q.description, q.requirements, q.deadline, q.rewardPerWinner, q.maxWinners, q.winners, q.cancelled);
    }

    function getSubmission(uint256 questId, address participant) external view returns (string memory proof, uint64 submittedAt, bool approved) {
        Submission storage s = submissions[questId][participant]; return (s.proof, s.submittedAt, s.approved);
    }
}
