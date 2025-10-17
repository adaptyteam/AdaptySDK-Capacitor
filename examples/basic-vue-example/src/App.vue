<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { adapty, createPaywallView, AdaptyProfile, AdaptyPaywall } from '@adapty/capacitor';
import { getApiKey, getPlacementId } from './helpers';
import { recipes, Recipe } from './recipes';

// State management
const isLoading = ref(true);
const error = ref<string | null>(null);
const profile = ref<AdaptyProfile | null>(null);
const paywall = ref<AdaptyPaywall | null>(null);
const selectedRecipe = ref<Recipe | null>(null);

// Check if user has premium access
const isPremiumActive = computed(() => profile.value?.accessLevels?.['premium']?.isActive ?? false);

// Initialize Adapty: activate, load profile, load paywall
const initializeAdapty = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    // Step 1: Activate SDK
    await adapty.activate({
      apiKey: getApiKey(),
      params: {
        // Prevent SDK re-activation on fast refresh during development
        __ignoreActivationOnFastRefresh: import.meta.env.DEV,
      },
    });

    // Step 2: Get user profile
    const userProfile = await adapty.getProfile();
    profile.value = userProfile;

    // Step 3: Load paywall
    const paywallData = await adapty.getPaywall({
      placementId: getPlacementId(),
    });
    paywall.value = paywallData;

    isLoading.value = false;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Adapty SDK';
    error.value = errorMessage;
    isLoading.value = false;
  }
};

// Handle recipe click
const handleRecipeClick = async (recipe: Recipe) => {
  // If recipe is not premium or user has premium access, show details
  const isRecipeFree = !recipe.isPremium;
  if (isRecipeFree || isPremiumActive.value) {
    selectedRecipe.value = recipe;
    return;
  }

  // Otherwise, show paywall
  await showPaywall();
};

// Show paywall using Paywall Builder
const showPaywall = async () => {
  if (!paywall.value) {
    error.value = 'Paywall not loaded. Please try again.';
    return;
  }

  if (!paywall.value.hasViewConfiguration) {
    error.value = 'Paywall does not have Paywall Builder configuration.';
    return;
  }

  try {
    // Create paywall view
    const view = await createPaywallView(paywall.value);

    // Set up event handlers
    await view.setEventHandlers({
      onPurchaseCompleted: (purchaseResult, _product) => {
        // Purchase completed successfully
        if (purchaseResult.type === 'success') {
          // Update profile to reflect new access level
          profile.value = purchaseResult.profile;
          // Close paywall
          return true;
        }
        // Don't close for cancelled or pending purchases
        return false;
      },
    });

    // Present the paywall
    await view.present();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to show paywall';
    error.value = errorMessage;
  }
};

// Go back from recipe detail view
const handleBack = () => {
  selectedRecipe.value = null;
};

// Initialize Adapty SDK on mount
onMounted(() => {
  initializeAdapty();
});
</script>

<template>
  <div class="container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading">Loading Adapty SDK...</div>

    <!-- Detail view for selected recipe -->
    <div v-else-if="selectedRecipe" class="detailView">
      <h2>{{ selectedRecipe.title }}</h2>
      <p>{{ selectedRecipe.description }}</p>
      <button class="backButton" @click="handleBack">← Back to Recipes</button>
    </div>

    <!-- Main recipe list view -->
    <template v-else>
      <header class="header">
        <h1>Adapty Recipes (Vue)</h1>
      </header>

      <!-- Error display -->
      <div v-if="error" class="error">{{ error }}</div>

      <!-- Premium status bar -->
      <div :class="['statusBar', isPremiumActive ? 'statusPremium' : 'statusFree']">
        {{ isPremiumActive ? '✓ Premium Active' : 'Free Plan' }}
      </div>

      <!-- Basic Recipes Section -->
      <section class="section">
        <h2 class="sectionTitle">Basic Recipes (Free)</h2>
        <div
          v-for="recipe in recipes.filter((r) => !r.isPremium)"
          :key="recipe.id"
          class="recipeCard"
          @click="handleRecipeClick(recipe)"
        >
          <div class="recipeTitle">{{ recipe.title }}</div>
          <div class="recipeDescription">{{ recipe.description }}</div>
        </div>
      </section>

      <!-- Premium Recipes Section -->
      <section class="section">
        <h2 class="sectionTitle">Premium Recipes</h2>
        <div
          v-for="recipe in recipes.filter((r) => r.isPremium)"
          :key="recipe.id"
          :class="['recipeCard', !isPremiumActive && 'recipeCardLocked']"
          @click="handleRecipeClick(recipe)"
        >
          <div class="recipeTitle">
            <span v-if="!isPremiumActive" class="lockIcon">🔒</span>
            {{ recipe.title }}
          </div>
          <div class="recipeDescription">{{ recipe.description }}</div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  padding-top: max(20px, env(safe-area-inset-top));
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 32px;
  margin: 0 0 10px 0;
  color: #333;
}

.statusBar {
  padding: 12px 20px;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  margin-bottom: 30px;
  font-size: 16px;
}

.statusPremium {
  background-color: #4caf50;
  color: white;
}

.statusFree {
  background-color: #9e9e9e;
  color: white;
}

.section {
  margin-bottom: 30px;
}

.sectionTitle {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #555;
  padding-left: 5px;
}

.recipeCard {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recipeCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

.recipeCardLocked {
  opacity: 0.7;
  background: #f5f5f5;
}

.recipeCardLocked:hover {
  border-color: #ff9800;
}

.recipeTitle {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.recipeDescription {
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.lockIcon {
  font-size: 16px;
}

.loading {
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: #666;
}

.error {
  background-color: #ffebee;
  color: #c62828;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #c62828;
}

.detailView {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.detailView h2 {
  font-size: 28px;
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

.detailView p {
  font-size: 16px;
  line-height: 1.6;
  color: #555;
  margin-bottom: 24px;
}

.backButton {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.backButton:hover {
  background-color: #0056b3;
}

.backButton:active {
  transform: scale(0.98);
}
</style>


