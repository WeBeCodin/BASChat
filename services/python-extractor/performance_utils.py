"""
Performance utilities for optimizing PDF extraction.
Includes memory management, caching, and performance monitoring.
"""

import time
import logging
import psutil
import os
from functools import wraps
from typing import Dict, Any, Optional
import gc

logger = logging.getLogger(__name__)

class PerformanceMonitor:
    """Monitor and log performance metrics for PDF extraction operations."""
    
    def __init__(self):
        self.metrics = {}
        
    def track_memory_usage(self, operation_name: str):
        """Decorator to track memory usage of operations."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Get initial memory usage
                process = psutil.Process(os.getpid())
                initial_memory = process.memory_info().rss / 1024 / 1024  # MB
                
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    success = True
                except Exception as e:
                    success = False
                    raise
                finally:
                    # Get final memory usage
                    final_memory = process.memory_info().rss / 1024 / 1024  # MB
                    execution_time = time.time() - start_time
                    
                    # Log performance metrics
                    self.metrics[operation_name] = {
                        'execution_time': execution_time,
                        'initial_memory_mb': initial_memory,
                        'final_memory_mb': final_memory,
                        'memory_delta_mb': final_memory - initial_memory,
                        'success': success
                    }
                    
                    logger.info(f"Performance [{operation_name}]: "
                              f"Time: {execution_time:.2f}s, "
                              f"Memory: {initial_memory:.1f}MB -> {final_memory:.1f}MB "
                              f"(Δ{final_memory - initial_memory:+.1f}MB)")
                
                return result
            return wrapper
        return decorator
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all collected performance metrics."""
        return self.metrics.copy()
    
    def reset_metrics(self):
        """Reset all collected metrics."""
        self.metrics.clear()

class MemoryManager:
    """Manage memory usage during PDF processing."""
    
    @staticmethod
    def cleanup():
        """Force garbage collection to free memory."""
        collected = gc.collect()
        logger.debug(f"Garbage collection freed {collected} objects")
        return collected
    
    @staticmethod
    def get_memory_usage() -> Dict[str, float]:
        """Get current memory usage statistics."""
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
            'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
            'percent': process.memory_percent(),
            'available_mb': psutil.virtual_memory().available / 1024 / 1024
        }
    
    @staticmethod
    def check_memory_limit(limit_mb: float = 1000) -> bool:
        """Check if memory usage exceeds the specified limit."""
        current_usage = MemoryManager.get_memory_usage()
        return current_usage['rss_mb'] > limit_mb
    
    @staticmethod
    def memory_efficient_processing(chunk_size: int = 5):
        """Decorator for memory-efficient processing of large datasets."""
        def decorator(func):
            @wraps(func)
            def wrapper(items, *args, **kwargs):
                if not isinstance(items, (list, tuple)):
                    return func(items, *args, **kwargs)
                
                results = []
                for i in range(0, len(items), chunk_size):
                    chunk = items[i:i + chunk_size]
                    chunk_result = func(chunk, *args, **kwargs)
                    
                    if isinstance(chunk_result, list):
                        results.extend(chunk_result)
                    else:
                        results.append(chunk_result)
                    
                    # Clean up memory after each chunk
                    if i % (chunk_size * 2) == 0:  # Every 2 chunks
                        MemoryManager.cleanup()
                
                return results
            return wrapper
        return decorator

class CacheManager:
    """Enhanced caching manager with LRU eviction and size limits."""
    
    def __init__(self, max_size: int = 100, max_memory_mb: float = 500):
        self.max_size = max_size
        self.max_memory_mb = max_memory_mb
        self.cache = {}
        self.access_order = []  # For LRU tracking
        self.cache_stats = {'hits': 0, 'misses': 0, 'evictions': 0}
    
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache, updating LRU order."""
        if key in self.cache:
            # Move to end (most recently used)
            self.access_order.remove(key)
            self.access_order.append(key)
            self.cache_stats['hits'] += 1
            return self.cache[key]
        
        self.cache_stats['misses'] += 1
        return None
    
    def put(self, key: str, value: Any):
        """Put item in cache, handling eviction if necessary."""
        # Check if we need to evict
        if len(self.cache) >= self.max_size:
            self._evict_lru()
        
        # Check memory usage
        if MemoryManager.check_memory_limit(self.max_memory_mb):
            logger.warning("Memory limit approached, clearing cache")
            self.clear()
        
        self.cache[key] = value
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)
    
    def _evict_lru(self):
        """Evict least recently used item."""
        if self.access_order:
            lru_key = self.access_order.pop(0)
            if lru_key in self.cache:
                del self.cache[lru_key]
                self.cache_stats['evictions'] += 1
                logger.debug(f"Evicted LRU cache entry: {lru_key}")
    
    def clear(self):
        """Clear all cache entries."""
        self.cache.clear()
        self.access_order.clear()
        MemoryManager.cleanup()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
        hit_rate = self.cache_stats['hits'] / total_requests if total_requests > 0 else 0
        
        return {
            **self.cache_stats,
            'hit_rate': round(hit_rate, 3),
            'cache_size': len(self.cache),
            'max_size': self.max_size
        }

# Global instances
performance_monitor = PerformanceMonitor()
cache_manager = CacheManager()

# Convenience decorators
def monitor_performance(operation_name: str):
    """Convenience decorator for performance monitoring."""
    return performance_monitor.track_memory_usage(operation_name)

def memory_efficient(chunk_size: int = 5):
    """Convenience decorator for memory-efficient processing."""
    return MemoryManager.memory_efficient_processing(chunk_size)