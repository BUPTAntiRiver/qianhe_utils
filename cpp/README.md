# C++ 库

每个库是 `cpp/qh-*/` 下的一个独立 CMake 项目，顶层 `cpp/CMakeLists.txt` 会自动把它们纳入构建。

## 新增库

```bash
mkdir -p cpp/qh-example/{include/qh,src,tests}
```

目录形态：

```
cpp/qh-example/
├── CMakeLists.txt
├── include/qh/example.hpp    # 公共头文件，统一放在 include/qh/ 下
├── src/example.cpp           # header-only 的库可以不要 src/
├── tests/example_test.cpp
└── README.md
```

`cpp/qh-example/CMakeLists.txt`：

```cmake
add_library(qh_example src/example.cpp)
add_library(qh::example ALIAS qh_example)

target_include_directories(qh_example PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_compile_features(qh_example PUBLIC cxx_std_20)

add_executable(qh_example_test tests/example_test.cpp)
target_link_libraries(qh_example_test PRIVATE qh_example)
add_test(NAME qh_example COMMAND qh_example_test)
```

header-only 的库把 `add_library(qh_example src/example.cpp)` 换成 `add_library(qh_example INTERFACE)` + `target_include_directories(qh_example INTERFACE ...)` 即可。

## 命令

```bash
cmake -S cpp -B cpp/build
cmake --build cpp/build -j
ctest --test-dir cpp/build --output-on-failure
```

`cmake` 还没装的话：`sudo apt install cmake`，或者 `uv tool install cmake`。没装期间可以用编译器直接检查头文件：

```bash
g++ -std=c++20 -Icpp/qh-example/include -fsyntax-only cpp/qh-example/tests/example_test.cpp
```

## 约定

- 命名空间统一 `qh::`，头文件名与库名一致（`qh-example` → `qh/example.hpp`）。
- 只把需要暴露的头文件放进 `include/`；实现细节放 `src/`，不要出现在 include 路径里。
- 测试框架建议 doctest 或 Catch2 的单头文件版，用 `FetchContent` 引入，避免在仓库里放第三方源码。
- 一个库一个 CMake target，库与库之间不要互相 `add_subdirectory` 绕圈，需要复用就单独抽一个库。
