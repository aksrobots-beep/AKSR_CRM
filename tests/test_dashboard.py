"""
Dashboard Tests for AK Success CRM
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from tests.test_auth import login

BASE_URL = "http://localhost:5173"

class TestDashboard:
    """Test cases for dashboard functionality."""
    
    def test_dashboard_loads_after_login(self, driver):
        """Test that dashboard loads correctly after login."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Wait for dashboard content
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "header"))
        )
        
        # Check welcome message
        header = driver.find_element(By.CSS_SELECTOR, "header h1")
        assert "Welcome" in header.text
    
    def test_dashboard_stats_cards_visible(self, driver):
        """Test that KPI stats cards are displayed."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Wait for stats cards to load
        stats_cards = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".card"))
        )
        
        # Should have multiple stats cards
        assert len(stats_cards) >= 4
    
    def test_dashboard_shows_open_tickets(self, driver):
        """Test that dashboard shows open tickets count."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Find the Open Tickets card
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Open Tickets" in page_text or "Ticket" in page_text
    
    def test_dashboard_shows_client_count(self, driver):
        """Test that dashboard shows active clients count."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Client" in page_text
    
    def test_dashboard_recent_activity(self, driver):
        """Test that recent activity section is visible."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Look for recent activity or similar section
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Recent" in page_text or "Activity" in page_text
    
    def test_sidebar_navigation_works(self, driver):
        """Test that sidebar navigation links work."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Find and click on Clients link
        clients_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Clients"))
        )
        clients_link.click()
        
        # Should navigate to clients page
        WebDriverWait(driver, 10).until(
            EC.url_contains("/clients")
        )
        assert "/clients" in driver.current_url
