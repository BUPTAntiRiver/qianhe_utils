cmake_minimum_required(VERSION 3.20)

project(qianhe_utils_cpp
  DESCRIPTION "个人 C++ 库集合"
  LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Debug CACHE STRING "构建类型" FORCE)
endif()

enable_testing()

# 自动纳入 cpp/qh-* 下所有带 CMakeLists.txt 的库，新增库不用改本文件
file(GLOB _lib_dirs LIST_DIRECTORIES true CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/qh-*")
foreach(_dir IN LISTS _lib_dirs)
  if(IS_DIRECTORY "${_dir}" AND EXISTS "${_dir}/CMakeLists.txt")
    message(STATUS "纳入 C++ 库: ${_dir}")
    add_subdirectory("${_dir}")
  endif()
endforeach()
