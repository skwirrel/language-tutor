<!-- QueueDisplay.svelte -->
<script>
  export let showUpcomingQueue;
  export let upcomingQueue;
</script>

{#if showUpcomingQueue && upcomingQueue.length > 0}
  <div class="queue-section">
    <h3 class="queue-title">Complete Learning Queue ({upcomingQueue.length} items)</h3>
    <div class="queue-list">
      {#each upcomingQueue as item}
        <div class="queue-item" class:current={item.position === 1}>
          <span class="queue-position">#{item.position}</span>
          <span class="queue-text">{item.source}</span>
          <span class="queue-category">{item.category}</span>
          <span class="queue-success-rate" class:struggling={item.successRate < 0.3} class:mastered={item.successRate > 0.7}>
            {item.recentResults.length === 0 ? 'New' : `${(item.successRate * 100).toFixed(0)}%`}
          </span>
          <span class="queue-success-count">
            {item.recentResults.filter(r => r).length}/{item.recentResults.length}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}
